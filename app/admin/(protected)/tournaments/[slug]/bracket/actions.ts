"use server";

import { revalidatePath } from "next/cache";
import { recordAction } from "@/lib/audit-log";
import { getAdminSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import {
  closeOverdueMatches,
  completeBracket,
  dismissNoShow,
  enterMatchResult,
  extendCurrentRoundDeadline,
  generateNextRound,
  startBracket,
} from "@/lib/backend/services/results.service";
import { getTournament } from "@/lib/tournaments";

export type BracketFormState = { error?: string };

/** Every action here runs behind the admin middleware, so a session always exists. */
async function actor() {
  const session = await getAdminSession();
  return {
    actorId: session?.userId ?? "unknown",
    actorUsername: session?.username ?? "unknown",
    actorDisplayName: session?.displayName ?? "unknown",
  };
}

export async function startBracketAction(
  _prev: BracketFormState,
  form: FormData,
): Promise<BracketFormState> {
  const slug = String(form.get("slug") ?? "");
  const event = await getTournament(slug);
  if (!event) return { error: "That tournament no longer exists." };

  try {
    await startBracket(slug, event);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not start the bracket." };
  }

  await recordAction({
    ...(await actor()),
    action: "bracket.start",
    target: slug,
    detail: `Started the bracket for "${event.name}"`,
  });

  revalidatePath(`/admin/tournaments/${slug}/bracket`);
  return {};
}

function bracketError(slug: string, message: string): never {
  redirect(`/admin/tournaments/${slug}/bracket?error=${encodeURIComponent(message)}`);
}

/**
 * A moderator writing the real result: which side won, and the series score.
 * There are no draws in this system, so the form asks for a winner and a
 * score rather than a per-player outcome.
 *
 * A rejected correction (the match already fed a later one that has been
 * played) comes back as a message on the page - failing silently is what made
 * "change result" look broken.
 */
export async function enterResultAction(form: FormData) {
  const slug = String(form.get("slug") ?? "");
  const matchId = String(form.get("matchId") ?? "");
  const winner = String(form.get("winner") ?? "");
  const winnerGames = Number(form.get("winnerGames") ?? 1);
  const loserGames = Number(form.get("loserGames") ?? 0);
  if (!slug || !matchId) return;
  if (winner !== "player1" && winner !== "player2") bracketError(slug, "Pick which player won.");
  if (!Number.isInteger(winnerGames) || !Number.isInteger(loserGames) || loserGames >= winnerGames) {
    bracketError(slug, "The winner has to have won more games than the loser.");
  }

  const p1Won = winner === "player1";
  try {
    await enterMatchResult(
      slug,
      matchId,
      p1Won ? winnerGames : loserGames,
      p1Won ? loserGames : winnerGames,
      0,
    );
  } catch (err) {
    bracketError(slug, err instanceof Error ? err.message : "Could not save that result.");
  }

  await recordAction({
    ...(await actor()),
    action: "bracket.result",
    target: slug,
    detail: `Entered a match result in "${slug}" (${p1Won ? `${winnerGames}-${loserGames}` : `${loserGames}-${winnerGames}`})`,
  });

  revalidatePath(`/admin/tournaments/${slug}/bracket`);
  revalidatePath(`/events/${slug}`);
}

/** A moderator calling off a no-show: the match simply carries on. */
export async function dismissNoShowAdminAction(form: FormData) {
  const slug = String(form.get("slug") ?? "");
  const matchId = String(form.get("matchId") ?? "");
  if (!slug || !matchId) return;

  const who = await actor();
  const dismissed = await dismissNoShow(slug, matchId, who.actorDisplayName);
  if (dismissed) {
    await recordAction({
      ...who,
      action: "bracket.no_show_dismissed",
      target: slug,
      detail: `Dismissed the no-show report on a match in "${slug}"`,
    });
  }

  revalidatePath(`/admin/tournaments/${slug}/bracket`);
  revalidatePath(`/events/${slug}`);
}

/**
 * Only valid for Swiss rounds (and to transition into top cut once they're
 * done) - the library throws during an active elimination stage, where
 * matches instead advance automatically as results come in. The page shows
 * this button whenever nothing is left to play in the current view, since
 * predicting library-internal validity ahead of calling it isn't worth
 * getting exactly right; a rejected call here is just a no-op.
 */
export async function nextRoundAction(form: FormData) {
  const slug = String(form.get("slug") ?? "");
  if (!slug) return;

  try {
    // A round locked by its own deadline may still hold matches nobody
    // reported - settle those first (exactly as the cron would) so starting
    // the next round by hand behaves the same as letting it start itself.
    // If that sweep already paired the next round (the cleanup window had
    // run out), pairing again here would skip a round entirely.
    const { advanced } = await closeOverdueMatches(slug);
    if (!advanced) await generateNextRound(slug);
  } catch {
    return;
  }

  await recordAction({
    ...(await actor()),
    action: "bracket.round",
    target: slug,
    detail: `Advanced "${slug}" to the next round`,
  });

  revalidatePath(`/admin/tournaments/${slug}/bracket`);
}

/**
 * Extends every currently-active match's deadline by the given number of
 * hours - e.g. the duel engine is down. Only touches the round in progress
 * (see extendCurrentRoundDeadline's own doc comment for why that's automatic).
 */
export async function extendRoundAction(form: FormData) {
  const slug = String(form.get("slug") ?? "");
  const hours = Number(form.get("hours") ?? "");
  if (!slug || !Number.isFinite(hours) || hours <= 0) return;

  const { extended } = await extendCurrentRoundDeadline(slug, hours);
  if (extended === 0) return;

  await recordAction({
    ...(await actor()),
    action: "bracket.extend_round",
    target: slug,
    detail: `Extended the deadline of ${extended} active match(es) in "${slug}" by ${hours}h`,
  });

  revalidatePath(`/admin/tournaments/${slug}/bracket`);
}

export async function completeBracketAction(form: FormData) {
  const slug = String(form.get("slug") ?? "");
  if (!slug) return;

  try {
    await completeBracket(slug);
  } catch {
    return;
  }

  await recordAction({
    ...(await actor()),
    action: "bracket.complete",
    target: slug,
    detail: `Completed the bracket for "${slug}" and froze final standings`,
  });

  revalidatePath(`/admin/tournaments/${slug}/bracket`);
  revalidatePath("/leaderboard");
  revalidatePath(`/events/${slug}`);
  revalidatePath("/dashboard");
}
