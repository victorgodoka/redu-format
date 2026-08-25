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
  repairRound,
  RepairConfirmationRequired,
  startBracket,
} from "@/lib/backend/services/results.service";
import { verifyTournament } from "@/lib/backend/services/duel-verification.service";
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
 * "change result" look broken. Changing the winner of a match whose bracket
 * descendants have already been played is a repair, not a plain correction:
 * it comes back the same way, naming what it would void, until the form's
 * "void those and proceed" box is checked and the action is resubmitted.
 */
export async function enterResultAction(form: FormData) {
  const slug = String(form.get("slug") ?? "");
  const matchId = String(form.get("matchId") ?? "");
  const winner = String(form.get("winner") ?? "");
  const winnerGames = Number(form.get("winnerGames") ?? 1);
  const loserGames = Number(form.get("loserGames") ?? 0);
  const confirmRepair = form.get("confirmRepair") === "on";
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
      { confirm: confirmRepair },
    );
  } catch (err) {
    if (err instanceof RepairConfirmationRequired) bracketError(slug, `${err.message} Check the box below and save again.`);
    bracketError(slug, err instanceof Error ? err.message : "Could not save that result.");
  }

  await recordAction({
    ...(await actor()),
    action: "bracket.result",
    target: slug,
    detail: `Entered a match result in "${slug}" (${p1Won ? `${winnerGames}-${loserGames}` : `${loserGames}-${winnerGames}`})${confirmRepair ? " - repair confirmed, voiding downstream matches" : ""}`,
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
 * Extends every currently-active match's deadline by the given amount of
 * time - e.g. the duel engine is down. Accepts hours or days from the form
 * and converts to the hours the service takes. Only touches the round in
 * progress (see extendCurrentRoundDeadline's own doc comment for why that's
 * automatic).
 */
export async function extendRoundAction(form: FormData) {
  const slug = String(form.get("slug") ?? "");
  const amount = Number(form.get("amount") ?? "");
  const unit = String(form.get("unit") ?? "hours");
  if (!slug || !Number.isFinite(amount) || amount <= 0) return;

  const hours = unit === "days" ? amount * 24 : amount;
  const { extended } = await extendCurrentRoundDeadline(slug, hours);
  if (extended === 0) return;

  await recordAction({
    ...(await actor()),
    action: "bracket.extend_round",
    target: slug,
    detail: `Extended the deadline of ${extended} active match(es) in "${slug}" by ${amount} ${unit}`,
  });

  revalidatePath(`/admin/tournaments/${slug}/bracket`);
}

/**
 * Runs the same verification pass automatic polling does, on demand -
 * verifyTournament() itself decides whether that means a fresh get-info.php
 * call or just re-checking already-cached replays (the 5-minute cache/lock
 * applies here exactly as it does everywhere else, per spec). No separate
 * resolution algorithm lives here or anywhere in the UI layer.
 */
export async function updateBracketStatusAction(form: FormData) {
  const slug = String(form.get("slug") ?? "");
  if (!slug) return;

  await verifyTournament(slug).catch(() => null);
  revalidatePath(`/admin/tournaments/${slug}/bracket`);
  revalidatePath(`/events/${slug}`);
}

/**
 * Throws away the current Swiss round and pairs it again. Destructive by
 * design - the confirm dialog on the button is what stands between a mistyped
 * click and a round of duels being voided - so the outcome is spelled out in
 * the audit log rather than just "repaired".
 */
export async function repairRoundAction(form: FormData) {
  const slug = String(form.get("slug") ?? "");
  if (!slug) return;

  let result;
  try {
    result = await repairRound(slug);
  } catch (err) {
    bracketError(slug, err instanceof Error ? err.message : "Could not re-pair that round.");
  }

  await recordAction({
    ...(await actor()),
    action: "bracket.repair_round",
    target: slug,
    detail: `Re-paired round ${result.round} in "${slug}" - voided ${result.voidedMatches} match(es), paired ${result.pairedMatches}, added ${result.addedPlayers} late entrant(s)`,
  });

  revalidatePath(`/admin/tournaments/${slug}/bracket`);
  revalidatePath(`/events/${slug}`);
  redirect(`/admin/tournaments/${slug}/bracket`);
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
