"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { findPlayerIdByToken } from "@/lib/backend/services/player.service";
import { findMyRegistrationId } from "@/lib/backend/services/registration.service";
import { acceptRedo, rejectRedo, requestRedo } from "@/lib/backend/services/redo.service";
import {
  closeOverdueMatches,
  contestMatchResult,
  dismissNoShow,
  reportNoShow,
  submitMatchReport,
} from "@/lib/backend/services/results.service";
import { verifyTournament } from "@/lib/backend/services/duel-verification.service";

/** Resolves the signed-in player to their registration in this tournament, or null if they aren't in it. */
async function me(slug: string): Promise<string | null> {
  const session = await getSession();
  if (!session.token) return null;
  const playerId = await findPlayerIdByToken(session.token);
  if (!playerId) return null;
  return findMyRegistrationId(slug, playerId);
}

function refresh(slug: string) {
  revalidatePath(`/events/${slug}`);
  // The same cards render on the dashboard (components/site/MyRound).
  revalidatePath("/dashboard");
}

/**
 * One report settles the duel: who won, and the series score. The opponent
 * does not confirm anything - they see it and can contest it.
 *
 * Fire-and-forget, like the other bracket forms: a rejected report (locked
 * round, not your match, impossible score) is a no-op on the page, and the
 * card re-renders showing why reporting is closed.
 */
export async function submitMatchReportAction(form: FormData) {
  const slug = String(form.get("slug") ?? "");
  const matchId = String(form.get("matchId") ?? "");
  // One value carries the whole call: "win:2:1" is "I won the series 2-1".
  const [outcome, winner, loser] = String(form.get("score") ?? "").split(":");
  const won = outcome === "win";
  const winnerGames = Number(winner);
  const loserGames = Number(loser);
  if (!slug || !matchId || (outcome !== "win" && outcome !== "loss")) return;
  if (!Number.isInteger(winnerGames) || !Number.isInteger(loserGames)) return;

  const registrationId = await me(slug);
  if (!registrationId) return;

  try {
    await submitMatchReport(slug, matchId, registrationId, won, winnerGames, loserGames);
  } catch {
    return;
  }

  // Deployment only allows one cron run a day, so live tournaments settle on
  // requests too - reporting is the most frequent one there is.
  await closeOverdueMatches(slug).catch(() => null);
  refresh(slug);
}

/** "That result is wrong" - flags the match and hands a moderator the whole picture. */
export async function contestResultAction(form: FormData) {
  const slug = String(form.get("slug") ?? "");
  const matchId = String(form.get("matchId") ?? "");
  if (!slug || !matchId) return;

  const registrationId = await me(slug);
  if (!registrationId) return;

  try {
    await contestMatchResult(slug, matchId, registrationId);
  } catch {
    return;
  }
  refresh(slug);
}

/** "My opponent never turned up." */
export async function reportNoShowAction(form: FormData) {
  const slug = String(form.get("slug") ?? "");
  const matchId = String(form.get("matchId") ?? "");
  if (!slug || !matchId) return;

  const registrationId = await me(slug);
  if (!registrationId) return;

  try {
    await reportNoShow(slug, matchId, registrationId);
  } catch {
    return;
  }
  refresh(slug);
}

/** Either player in the duel can call off a no-show - being there is the whole answer to it. */
export async function dismissNoShowAction(form: FormData) {
  const slug = String(form.get("slug") ?? "");
  const matchId = String(form.get("matchId") ?? "");
  if (!slug || !matchId) return;

  const registrationId = await me(slug);
  if (!registrationId) return;

  await dismissNoShow(slug, matchId, `player:${registrationId}`).catch(() => false);
  refresh(slug);
}

/** "Our duel disconnected - let's redo it." */
export async function requestRedoAction(form: FormData) {
  const slug = String(form.get("slug") ?? "");
  const matchId = String(form.get("matchId") ?? "");
  if (!slug || !matchId) return;

  const registrationId = await me(slug);
  if (!registrationId) return;

  await requestRedo(slug, matchId, registrationId).catch(() => null);
  refresh(slug);
}

/** "I agree, let's redo it." Runs a verification pass right after in case both sides had already accepted moments apart - so the fresh lobby appears without waiting for the next poll. */
export async function acceptRedoAction(form: FormData) {
  const slug = String(form.get("slug") ?? "");
  const matchId = String(form.get("matchId") ?? "");
  if (!slug || !matchId) return;

  const registrationId = await me(slug);
  if (!registrationId) return;

  await acceptRedo(slug, matchId, registrationId).catch(() => null);
  await verifyTournament(slug).catch(() => null);
  refresh(slug);
}

/** "No, the result stands." */
export async function rejectRedoAction(form: FormData) {
  const slug = String(form.get("slug") ?? "");
  const matchId = String(form.get("matchId") ?? "");
  if (!slug || !matchId) return;

  const registrationId = await me(slug);
  if (!registrationId) return;

  await rejectRedo(slug, matchId, registrationId).catch(() => null);
  refresh(slug);
}
