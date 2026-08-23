/**
 * The disconnect redo flow: request -> consent from both sides -> a fresh
 * lobby. Every mutation here is a single guarded UPDATE (see
 * redo-requests.repository.ts's recordConsent/claimAccepted/reject/
 * expireIfDue) rather than a read-then-write, which is what makes two
 * concurrent accepts, a stale accept after a reject, or an accept after
 * expiry all resolve to "nothing happens" instead of a race. Reuses
 * generateNexusRoomHash() (the same function that makes every other lobby in
 * this app) for the replacement room - never a bespoke id scheme.
 */
import type { Pool } from "mysql2/promise";
import { getPool } from "../db/client.ts";
import { DuelAttemptsRepository } from "../repositories/duel-attempts.repository.ts";
import { DuelSlotsRepository } from "../repositories/duel-slots.repository.ts";
import { RedoRequestsRepository, type RedoRequestStatus } from "../repositories/redo-requests.repository.ts";
import { RegistrationsRepository } from "../repositories/registrations.repository.ts";
import { TournamentsRepository } from "../repositories/tournaments.repository.ts";
import { NEXUS_WIN_REASON_DISCONNECT } from "../../nexus-parse.ts";
import { REDO_REQUEST_TTL_MS } from "./duel-verification.service.ts";
import { generateNexusRoomHash } from "./nexus-room.ts";
import { getBracketView } from "./results.service.ts";

function repos(pool: Pool = getPool()) {
  return {
    tournaments: new TournamentsRepository(pool),
    registrations: new RegistrationsRepository(pool),
    slots: new DuelSlotsRepository(pool),
    attempts: new DuelAttemptsRepository(pool),
    redoRequests: new RedoRequestsRepository(pool),
  };
}

async function notifyPlayer(registrationId: string, input: { kind: string; title: string; body: string; fingerprint: string }): Promise<void> {
  const playerId = await repos().registrations.findPlayerIdByRegistration(registrationId);
  if (!playerId) return;
  const { notify } = await import("./notifications.service.ts");
  const { createHash } = await import("node:crypto");
  await notify({
    id: crypto.randomUUID(),
    audience: "player",
    playerId,
    kind: input.kind,
    title: input.title,
    body: input.body,
    metadata: null,
    fingerprint: createHash("sha256").update(input.fingerprint).digest("hex"),
  });
}

/** Validates the caller is actually in this match, and returns their opponent's registration id. Null for anyone else - including a moderator, who has no redo say (this is a players-only flow). */
async function matchContext(
  slug: string,
  matchId: string,
  registrationId: string,
): Promise<{ opponentRegistrationId: string } | null> {
  const view = await getBracketView(slug);
  const match = view?.matches.find((m) => m.id === matchId);
  if (!match || !match.player1 || !match.player2) return null;
  if (registrationId === match.player1.registrationId) return { opponentRegistrationId: match.player2.registrationId };
  if (registrationId === match.player2.registrationId) return { opponentRegistrationId: match.player1.registrationId };
  return null;
}

/**
 * The disconnected attempt a redo can currently be requested/decided for: the
 * match's furthest-along duel slot's latest attempt, if it completed by
 * disconnect and isn't already counting toward the score. Once it counts (the
 * grace window lapsed, or a request was rejected/expired) or a redo was
 * already accepted, this returns null - there is nothing left to redo.
 */
async function eligibleAttempt(slug: string, matchId: string) {
  const tournamentId = await repos().tournaments.findIdBySlug(slug);
  if (!tournamentId) return null;
  const slots = await repos().slots.listForMatch(matchId);
  const slot = slots[slots.length - 1];
  if (!slot) return null;
  const attempts = await repos().attempts.listForSlot(slot.id);
  const latest = attempts[attempts.length - 1];
  if (!latest || latest.status !== "completed" || latest.winReason !== NEXUS_WIN_REASON_DISCONNECT || latest.counts) return null;
  return { tournamentId, slot, attempt: latest };
}

export type RedoStatus = {
  attemptId: string;
  requestId: string | null;
  status: "eligible" | RedoRequestStatus;
  requestedByMe: boolean;
  myConsent: boolean;
  opponentConsent: boolean;
  expiresAt: string | null;
} | null;

/**
 * What the match's redo card (if any) should show for this player - see
 * components/site/MyRound. Deliberately broader than eligibleAttempt() (which
 * guards the mutations): this also has to keep showing "accepted" for a
 * moment after acceptRedo() has already superseded the old attempt, so the
 * success message doesn't just vanish the instant it's true.
 */
export async function getRedoStatus(slug: string, matchId: string, registrationId: string): Promise<RedoStatus> {
  const ctx = await matchContext(slug, matchId, registrationId);
  if (!ctx) return null;

  const slots = await repos().slots.listForMatch(matchId);
  const slot = slots[slots.length - 1];
  if (!slot) return null;
  const attempts = await repos().attempts.listForSlot(slot.id);
  const latest = attempts[attempts.length - 1];
  if (!latest || latest.winReason !== NEXUS_WIN_REASON_DISCONNECT || (latest.status === "completed" && latest.counts)) {
    return null; // no disconnect in play here, or it's already settled as a normal loss - nothing left to show.
  }

  const request = await repos().redoRequests.findByAttempt(latest.id);
  if (!request) {
    if (latest.status !== "completed") return null; // still being resolved - not eligible yet either.
    return { attemptId: latest.id, requestId: null, status: "eligible", requestedByMe: false, myConsent: false, opponentConsent: false, expiresAt: null };
  }
  const isPlayerA = request.playerARegistrationId === registrationId;
  return {
    attemptId: latest.id,
    requestId: request.id,
    status: request.status,
    requestedByMe: request.requesterRegistrationId === registrationId,
    myConsent: isPlayerA ? request.playerAConsent : request.playerBConsent,
    opponentConsent: isPlayerA ? request.playerBConsent : request.playerAConsent,
    expiresAt: request.expiresAt,
  };
}

export type RedoActionOutcome =
  | "requested"
  | "consented"
  | "accepted"
  | "rejected"
  | "expired"
  | "not-eligible"
  | "not-your-match"
  | "no-request";

/** "Let's redo that one." Opens the request with the requester's own consent already recorded - see RedoRequestsRepository.create. */
export async function requestRedo(slug: string, matchId: string, registrationId: string): Promise<RedoActionOutcome> {
  const ctx = await matchContext(slug, matchId, registrationId);
  if (!ctx) return "not-your-match";
  const eligible = await eligibleAttempt(slug, matchId);
  if (!eligible) return "not-eligible";

  const now = new Date();
  await repos().redoRequests.create({
    id: crypto.randomUUID(),
    duelAttemptId: eligible.attempt.id,
    requesterRegistrationId: registrationId,
    playerARegistrationId: registrationId,
    playerBRegistrationId: ctx.opponentRegistrationId,
    expiresAt: new Date(now.getTime() + REDO_REQUEST_TTL_MS),
    now,
  });
  // Idempotent either way (create() no-ops if one already exists for this
  // attempt) - a repeat click reports the same outcome, never an error.

  await notifyPlayer(ctx.opponentRegistrationId, {
    kind: "duel.redo_requested",
    title: "Your opponent asked to redo a disconnected duel",
    body: `Your duel ended in a disconnect. Your opponent is asking to redo it - accept if you agree, or it stands as played in ${Math.round(REDO_REQUEST_TTL_MS / 60000)} minutes if nobody responds.`,
    fingerprint: `redo_requested|${eligible.attempt.id}`,
  });
  return "requested";
}

/** "I agree." Records this player's consent, and - only for whichever caller actually completes the pair - generates the replacement lobby. */
export async function acceptRedo(slug: string, matchId: string, registrationId: string): Promise<RedoActionOutcome> {
  const ctx = await matchContext(slug, matchId, registrationId);
  if (!ctx) return "not-your-match";
  const eligible = await eligibleAttempt(slug, matchId);
  if (!eligible) return "not-eligible";

  const request = await repos().redoRequests.findByAttempt(eligible.attempt.id);
  if (!request) return "no-request";
  if (request.status !== "pending") return request.status;

  const now = new Date();
  if (new Date(request.expiresAt).getTime() <= now.getTime()) {
    await repos().redoRequests.expireIfDue(request.id, now);
    return "expired";
  }

  const isPlayerA = request.playerARegistrationId === registrationId;
  const consented = await repos().redoRequests.recordConsent(request.id, registrationId, isPlayerA, now);
  if (!consented) return "expired"; // lost a race with expiry between the reads above and this write.

  const fresh = await repos().redoRequests.findByAttempt(eligible.attempt.id);
  if (!fresh || !fresh.playerAConsent || !fresh.playerBConsent) return "consented";

  const replacementRoomHash = generateNexusRoomHash();
  const claimed = await repos().redoRequests.claimAccepted(fresh.id, replacementRoomHash, now);
  if (!claimed) return "consented"; // another concurrent accept already finished this - nothing more for this caller to do.

  await repos().attempts.supersede(eligible.attempt.id);
  await repos().slots.updateCurrentRoomHash(eligible.slot.id, replacementRoomHash);

  const other = fresh.requesterRegistrationId === fresh.playerARegistrationId ? fresh.playerBRegistrationId : fresh.playerARegistrationId;
  for (const id of [fresh.requesterRegistrationId, other]) {
    await notifyPlayer(id, {
      kind: "duel.redo_accepted",
      title: "Redo accepted - new duel room ready",
      body: "Both of you agreed to redo the disconnected duel. Open the tournament page for the fresh duel room.",
      fingerprint: `redo_accepted|${fresh.id}`,
    });
  }
  return "accepted";
}

/** Either player calling it off - the disconnect then stands once its normal grace window runs out. */
export async function rejectRedo(slug: string, matchId: string, registrationId: string): Promise<RedoActionOutcome> {
  const ctx = await matchContext(slug, matchId, registrationId);
  if (!ctx) return "not-your-match";
  const eligible = await eligibleAttempt(slug, matchId);
  if (!eligible) return "not-eligible";

  const request = await repos().redoRequests.findByAttempt(eligible.attempt.id);
  if (!request) return "no-request";
  if (request.status !== "pending") return request.status;

  const rejected = await repos().redoRequests.reject(request.id, new Date());
  if (!rejected) return "expired";

  await notifyPlayer(request.requesterRegistrationId, {
    kind: "duel.redo_rejected",
    title: "Your redo request was declined",
    body: "Your opponent declined the redo - the disconnected duel stands as played.",
    fingerprint: `redo_rejected|${request.id}`,
  });
  return "rejected";
}
