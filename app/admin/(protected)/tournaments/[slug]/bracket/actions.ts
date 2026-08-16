"use server";

import { revalidatePath } from "next/cache";
import { recordAction } from "@/lib/audit-log";
import { getAdminSession } from "@/lib/auth/session";
import {
  completeBracket,
  enterMatchResult,
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

export async function enterResultAction(form: FormData) {
  const slug = String(form.get("slug") ?? "");
  const matchId = String(form.get("matchId") ?? "");
  const player1Wins = Number(form.get("player1Wins"));
  const player2Wins = Number(form.get("player2Wins"));
  const draws = Number(form.get("draws") ?? "0");
  if (!slug || !matchId) return;
  if (
    !Number.isInteger(player1Wins) ||
    !Number.isInteger(player2Wins) ||
    player1Wins < 0 ||
    player2Wins < 0
  ) {
    return;
  }

  await enterMatchResult(slug, matchId, player1Wins, player2Wins, Number.isInteger(draws) ? draws : 0);

  await recordAction({
    ...(await actor()),
    action: "bracket.result",
    target: slug,
    detail: `Reported a match result in "${slug}" (${player1Wins}-${player2Wins}${draws ? `-${draws} draws` : ""})`,
  });

  revalidatePath(`/admin/tournaments/${slug}/bracket`);
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
    await generateNextRound(slug);
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
