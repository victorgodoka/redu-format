/**
 * The automatic duel-result pipeline:
 *
 *   find active/unresolved matches -> claim the 5-minute fetch window ->
 *   pull get-info.php only if claimed -> match replays to duel slots by lobby
 *   + players -> fetch get-replay-info.php for the ones that matter ->
 *   validate players and decks -> resolve each duel attempt (handling
 *   disconnects/redos) -> tally the Bo1/Bo3 score -> hand a decided match to
 *   the existing bracket engine.
 *
 * Deliberately thin on bracket logic: resolving a match always goes through
 * results.service.ts's enterMatchResult()/disqualifyRegistration() - the same
 * functions an admin's manual correction uses - so there is exactly one place
 * that ever mutates the bracket, automatic or not. This module only ever
 * decides *what* the result is; it never advances anything itself.
 *
 * Idempotent by construction, not by a special "already processed" flag:
 * every pass recomputes a match's score fresh from its persisted duel_attempts,
 * and only calls enterMatchResult() while the match is still active (unresolved) -
 * once resolved, getBracketView() reports hasResult=true and this module never
 * looks at that match again, on this pass or any later one.
 */
import type { Pool } from "mysql2/promise";
import { diffDeckLists, parseSnapshot } from "../../deck-diff.ts";
import { NEXUS_WIN_REASON_DISCONNECT } from "../../nexus-parse.ts";
import { getTournament } from "../../tournaments.ts";
import { getPool } from "../db/client.ts";
import { DuelAttemptsRepository, type DuelAttempt } from "../repositories/duel-attempts.repository.ts";
import { DuelSlotsRepository, type DuelSlot } from "../repositories/duel-slots.repository.ts";
import { NexusFetchLogRepository } from "../repositories/nexus-fetch-log.repository.ts";
import { NexusReplayCacheRepository, type CachedReplay } from "../repositories/nexus-replay-cache.repository.ts";
import { RedoRequestsRepository, type RedoRequest } from "../repositories/redo-requests.repository.ts";
import { RegistrationsRepository } from "../repositories/registrations.repository.ts";
import { TournamentBracketsRepository } from "../repositories/tournament-brackets.repository.ts";
import { TournamentsRepository } from "../repositories/tournaments.repository.ts";
import { findAnyLinkedNexusToken } from "./admins.service.ts";
import { fetchNexusReplayDetails, fetchNexusReplayList } from "./nexus-client.ts";
import { disqualifyRegistration, enterMatchResult, getBracketView, winningGames, type BracketMatch } from "./results.service.ts";

/** How long a get-info.php fetch for one tournament is trusted before it's worth calling again - the DB-backed cross-client cache/lock, per nexus-fetch-log.repository.ts. */
const FETCH_CACHE_MS = 5 * 60 * 1000;

/**
 * ponytail: how long a disconnected duel waits for someone to click "Request
 * Redo" before it just counts as played. Not pinned by spec - long enough to
 * notice and click, short enough not to stall a round on a duel nobody is
 * going to ask to redo. Raise it if TOs report players getting counted out
 * before they can react.
 */
export const DISCONNECT_REDO_GRACE_MS = 15 * 60 * 1000;

/** How long a redo request waits for the other player before it lapses back to the normal disconnect rule. Server-enforced - see verifyTournament's expiry sweep. */
export const REDO_REQUEST_TTL_MS = 30 * 60 * 1000;

function repos(pool: Pool = getPool()) {
  return {
    tournaments: new TournamentsRepository(pool),
    registrations: new RegistrationsRepository(pool),
    fetchLog: new NexusFetchLogRepository(pool),
    replayCache: new NexusReplayCacheRepository(pool),
    slots: new DuelSlotsRepository(pool),
    attempts: new DuelAttemptsRepository(pool),
    redoRequests: new RedoRequestsRepository(pool),
  };
}

/**
 * game_name is the room hash itself - the "NA-" in the duel link
 * (duelingnexus.com/duel/NA-{hash}) is a region prefix the client shows, not
 * part of the name Nexus reports back. generateNexusRoomHash() always
 * produces uppercase (see nexus-room.ts's BASE36_CHARS), so the lowercase
 * form only guards against Nexus normalizing it on its own end.
 */
export function candidateGameNames(roomHash: string): string[] {
  return [...new Set([roomHash, roomHash.toLowerCase()])];
}

/**
 * Whether a completed winReason=4 (connection loss) attempt counts toward the
 * match score right now - re-evaluated fresh on every pass from persisted
 * state, never a running timer:
 *
 * - no redo ever requested: counts once DISCONNECT_REDO_GRACE_MS has passed
 *   since *this app first saw the attempt* (attempt.createdAt) - deliberately
 *   not the replay's own end_date. A verification gap (no admin token linked
 *   for a while, the tournament simply wasn't polled) can mean a disconnect
 *   is only discovered well after DISCONNECT_REDO_GRACE_MS has already
 *   elapsed on Nexus's clock; counting it from discovery instead means
 *   players always get a real window to click "Request Redo" through this
 *   app, regardless of how late the discovery was. Free to compute - no
 *   extra Nexus or database call, createdAt is already loaded with the row.
 * - a redo is pending: never counts (its acceptance/rejection/expiry decides
 *   this attempt's fate, not the passage of time on its own).
 * - a redo was accepted: never counts - the replacement attempt is what
 *   matters now.
 * - a redo was rejected or expired: counts, per the tournament's normal
 *   disconnect rule.
 */
export function disconnectCounts(attemptCreatedAt: string, redo: RedoRequest | null, now: Date): boolean {
  if (redo) {
    if (redo.status === "accepted") return false;
    if (redo.status === "pending") return false;
    return true; // rejected or expired
  }
  return now.getTime() - new Date(attemptCreatedAt).getTime() >= DISCONNECT_REDO_GRACE_MS;
}

type RegInfo = { playerId: string | null; nexusUserId: string | null; deckLockedSnapshot: unknown };

/** Multiset-compares a played main/extra deck (from replay_data, no side info) against the locked snapshot's main/extra - order never matters, only what's actually different. */
function deckMatchesLocked(locked: { main: number[]; extra: number[] }, playedMain: number[], playedExtra: number[]): boolean {
  return diffDeckLists({ ...locked, side: [] }, { main: playedMain, extra: playedExtra, side: [] }).length === 0;
}

async function findUnconsumedReplay(roomHash: string, consumed: Set<string>, pool: Pool): Promise<CachedReplay | null> {
  const rows = await repos(pool).replayCache.listByGameNames(candidateGameNames(roomHash));
  return rows.find((r) => !consumed.has(r.replayId)) ?? null;
}

/**
 * Resolves one attempt whose replay is known but not yet judged: fetches
 * replay details if they aren't cached yet, validates the two expected
 * players actually played it, validates both decks against their locked
 * snapshot, and works out whether it's a counted win, a pending disconnect,
 * or a disqualification. Applies a DQ immediately (through the existing
 * disqualifyRegistration(), never bespoke bracket logic) and reports that up
 * so the caller stops touching this match.
 */
async function resolveAttempt(
  attempt: DuelAttempt,
  match: BracketMatch & { player1: NonNullable<BracketMatch["player1"]>; player2: NonNullable<BracketMatch["player2"]> },
  slug: string,
  regInfo: Map<string, RegInfo>,
  now: Date,
  pool: Pool,
): Promise<{ dqApplied: boolean; attempt: DuelAttempt }> {
  const { attempts, replayCache } = repos(pool);
  let cached = attempt.replayId ? await replayCache.findById(attempt.replayId) : null;
  if (!cached) return { dqApplied: false, attempt };

  if (cached.winningTeam === null) {
    const details = await fetchNexusReplayDetails(cached.replayId);
    if (!details) return { dqApplied: false, attempt }; // Nexus unreachable/incomplete - try again next pass, never guessed at.
    await replayCache.fetchDetails(cached.replayId, details, now);
    cached = { ...cached, winningTeam: details.winningTeam, winReason: details.winReason, mainDecks: details.mainDecks, extraDecks: details.extraDecks };
  }

  const inconclusive = async (winReason: number | null): Promise<{ dqApplied: boolean; attempt: DuelAttempt }> => {
    await attempts.resolve(attempt.id, { winnerRegistrationId: null, winReason, counts: false, dqRegistrationIds: null }, now);
    return { dqApplied: false, attempt: { ...attempt, status: "completed", winReason, counts: false } };
  };

  // Tag duels are explicitly out of scope (spec §8) - left permanently
  // unresolved here rather than guessed at; self-report or an admin override
  // still settle it.
  if (cached.isTag) return inconclusive(cached.winReason);

  const p1Info = regInfo.get(match.player1.registrationId);
  const p2Info = regInfo.get(match.player2.registrationId);
  const expectedP1 = p1Info?.nexusUserId;
  const expectedP2 = p2Info?.nexusUserId;

  // Missing a Nexus id for one of our own players (never logged in since this
  // shipped) is not evidence of anything - can't confirm the lobby either
  // way. Left genuinely open (the attempt stays "active", not resolved) so a
  // later login retries this for free from the already-cached replay,
  // instead of being permanently stuck the way a real dead end (a tag duel)
  // deliberately is.
  if (!expectedP1 || !expectedP2) return { dqApplied: false, attempt };

  const expected = [expectedP1, expectedP2];
  const inReplay = [cached.player1Id, cached.player2Id];
  const bothPresent = new Set(expected).size === 2 && expected.every((id) => inReplay.includes(id));
  if (!bothPresent) {
    const dqIds = [match.player1.registrationId, match.player2.registrationId].sort();
    await attempts.resolve(attempt.id, { winnerRegistrationId: null, winReason: cached.winReason, counts: false, dqRegistrationIds: dqIds }, now);
    for (const regId of dqIds) {
      await disqualifyRegistration(slug, regId, "Wrong player found in the assigned Dueling Nexus lobby for this duel", "system:nexus-verification");
    }
    return { dqApplied: true, attempt: { ...attempt, status: "completed", counts: false, dqRegistrationIds: dqIds } };
  }

  const p1IsTeam1 = cached.player1Id === p1Info!.nexusUserId;
  const teamIndexOf = (isTeam1: boolean) => (isTeam1 ? 0 : 1);

  const dqIds: string[] = [];
  for (const [registrationId, info, isTeam1] of [
    [match.player1.registrationId, p1Info, p1IsTeam1] as const,
    [match.player2.registrationId, p2Info, !p1IsTeam1] as const,
  ]) {
    const locked = parseSnapshot(info!.deckLockedSnapshot);
    if (!locked) continue; // no baseline on file - never invent a violation from nothing to compare against.
    const idx = teamIndexOf(isTeam1);
    const playedMain = cached.mainDecks?.[idx] ?? [];
    const playedExtra = cached.extraDecks?.[idx] ?? [];
    if (!deckMatchesLocked(locked, playedMain, playedExtra)) dqIds.push(registrationId);
  }

  if (dqIds.length > 0) {
    dqIds.sort();
    await attempts.resolve(attempt.id, { winnerRegistrationId: null, winReason: cached.winReason, counts: false, dqRegistrationIds: dqIds }, now);
    for (const regId of dqIds) {
      await disqualifyRegistration(slug, regId, "Deck played in this duel does not match the list locked in for this round", "system:nexus-verification");
    }
    return { dqApplied: true, attempt: { ...attempt, status: "completed", counts: false, dqRegistrationIds: dqIds } };
  }

  const winnerRegistrationId =
    cached.winningTeam === 1
      ? p1IsTeam1
        ? match.player1.registrationId
        : match.player2.registrationId
      : cached.winningTeam === 2
        ? p1IsTeam1
          ? match.player2.registrationId
          : match.player1.registrationId
        : null;
  if (!winnerRegistrationId) return inconclusive(cached.winReason);

  const isDisconnect = cached.winReason === NEXUS_WIN_REASON_DISCONNECT;
  const counts = isDisconnect ? disconnectCounts(attempt.createdAt, null, now) : true;

  await attempts.resolve(attempt.id, { winnerRegistrationId, winReason: cached.winReason, counts, dqRegistrationIds: null }, now);
  return {
    dqApplied: false,
    attempt: { ...attempt, status: "completed", winnerRegistrationId, winReason: cached.winReason, counts },
  };
}

/** Re-checks a completed-but-not-counting disconnect attempt against the current redo state/clock - see disconnectCounts(). Applies the flip if it changed and reports the (possibly updated) attempt back. */
async function refreshDisconnectCounts(attempt: DuelAttempt, now: Date, pool: Pool): Promise<DuelAttempt> {
  if (attempt.counts || attempt.winReason !== NEXUS_WIN_REASON_DISCONNECT) return attempt;
  const { attempts, redoRequests } = repos(pool);
  const redo = await redoRequests.findByAttempt(attempt.id);
  const stillCounts = disconnectCounts(attempt.createdAt, redo, now);
  if (stillCounts === attempt.counts) return attempt;
  await attempts.setCounts(attempt.id, stillCounts);
  return { ...attempt, counts: stillCounts };
}

async function ensureSlot(
  tournamentId: string,
  matchId: string,
  position: number,
  defaultRoomHash: string,
  existing: DuelSlot[],
  now: Date,
  pool: Pool,
): Promise<DuelSlot> {
  const found = existing.find((s) => s.position === position);
  if (found) return found;
  const { slots } = repos(pool);
  const id = crypto.randomUUID();
  await slots.ensureNext(id, tournamentId, matchId, position, defaultRoomHash, now);
  return (await slots.listForMatch(matchId)).find((s) => s.position === position)!;
}

/**
 * Resolves as much of one match as the currently-cached replays allow:
 * walks its duel slots in order, creating the next one on demand, and stops
 * the moment something can't be determined yet (no replay for that slot, a
 * pending disconnect/redo, an unresolved tag duel). Calls enterMatchResult()
 * the moment the tally reaches the format's winning-games count - never
 * before, and never again once it has (the active-match filter upstream
 * keeps this from re-running on an already-decided match).
 */
async function processMatch(
  match: BracketMatch & { player1: NonNullable<BracketMatch["player1"]>; player2: NonNullable<BracketMatch["player2"]>; roomHash: string },
  slug: string,
  tournamentId: string,
  regInfo: Map<string, RegInfo>,
  slotsByMatch: Map<string, DuelSlot[]>,
  consumedReplayIds: Set<string>,
  matchFormat: "Bo1" | "Bo3",
  now: Date,
  pool: Pool,
): Promise<void> {
  const needed = winningGames(matchFormat);
  const maxSlots = needed * 2 - 1;
  let p1Wins = 0;
  let p2Wins = 0;
  const { attempts } = repos(pool);

  for (let position = 1; position <= maxSlots && p1Wins < needed && p2Wins < needed; position++) {
    const slot = await ensureSlot(tournamentId, match.id, position, match.roomHash, slotsByMatch.get(match.id) ?? [], now, pool);

    const slotAttempts = await attempts.listForSlot(slot.id);
    let latest = slotAttempts[slotAttempts.length - 1];

    if (latest?.status === "active") {
      const result = await resolveAttempt(latest, match, slug, regInfo, now, pool);
      if (result.dqApplied) return;
      latest = result.attempt;
    }

    if (latest?.status === "completed") {
      latest = await refreshDisconnectCounts(latest, now, pool);
      if (latest.counts && latest.winnerRegistrationId) {
        if (latest.winnerRegistrationId === match.player1.registrationId) p1Wins++;
        else p2Wins++;
        continue;
      }
      return; // waiting on a redo decision, a tag duel, or missing replay details - nothing further to determine this pass.
    }

    // Slot is open: no attempt yet, or its last one was superseded by an
    // accepted redo (current_room_hash already points at the fresh lobby).
    const candidate = await findUnconsumedReplay(slot.currentRoomHash, consumedReplayIds, pool);
    if (!candidate) return; // nothing played here yet - later slots can't have happened either.

    const attemptId = crypto.randomUUID();
    const created = await attempts.create({
      id: attemptId,
      duelSlotId: slot.id,
      attemptNumber: slotAttempts.length + 1,
      roomHash: slot.currentRoomHash,
      replayId: candidate.replayId,
      now,
    });
    if (!created) {
      position--; // another caller just claimed this replay - re-read the same slot next loop iteration.
      continue;
    }
    consumedReplayIds.add(candidate.replayId);

    const fresh: DuelAttempt = {
      id: attemptId,
      duelSlotId: slot.id,
      attemptNumber: slotAttempts.length + 1,
      roomHash: slot.currentRoomHash,
      status: "active",
      replayId: candidate.replayId,
      winnerRegistrationId: null,
      winReason: null,
      counts: false,
      dqRegistrationIds: null,
      createdAt: now.toISOString(),
      resolvedAt: null,
    };
    const result = await resolveAttempt(fresh, match, slug, regInfo, now, pool);
    if (result.dqApplied) return;
    if (result.attempt.counts && result.attempt.winnerRegistrationId) {
      if (result.attempt.winnerRegistrationId === match.player1.registrationId) p1Wins++;
      else p2Wins++;
      continue;
    }
    return;
  }

  if (p1Wins >= needed || p2Wins >= needed) {
    await enterMatchResult(slug, match.id, p1Wins, p2Wins, 0);
  }
}

type ActiveMatch = BracketMatch & { player1: NonNullable<BracketMatch["player1"]>; player2: NonNullable<BracketMatch["player2"]>; roomHash: string };

/**
 * Runs one verification pass for a tournament: settles whatever the
 * currently-cached Nexus data allows, and - only if nothing has polled Nexus
 * for this tournament in the last five minutes - fetches fresh replay data
 * first. Safe to call from anywhere (page load, poll, manual button, cron):
 * every guard here is a database read, so two overlapping calls do at most
 * one extra get-info.php request and never duplicate a result.
 */
export async function verifyTournament(slug: string): Promise<void> {
  const pool = getPool();
  const event = await getTournament(slug);
  if (!event || event.status !== "running") return; // no active round to speak of.

  const view = await getBracketView(slug);
  if (!view || view.status === "complete") return;

  const activeMatches = view.matches.filter(
    (m): m is ActiveMatch => m.active && !m.hasResult && !m.bye && m.roomHash !== null && m.player1 !== null && m.player2 !== null,
  );
  if (activeMatches.length === 0) return; // nothing unresolved - never queries Nexus for a tournament with no open duels.

  const tournamentId = await repos(pool).tournaments.findIdBySlug(slug);
  if (!tournamentId) return;

  const now = new Date();
  const { slots, attempts, redoRequests, fetchLog, replayCache } = repos(pool);

  // Server-side redo-expiry sweep - runs every pass, never a client timer.
  for (const pending of await redoRequests.listPending(tournamentId)) {
    if (new Date(pending.expiresAt).getTime() <= now.getTime()) await redoRequests.expireIfDue(pending.id, now);
  }

  // One bulk read instead of one listForMatch() per active match - only the
  // matches actually missing a slot 1 (new this pass) cost a write.
  let slotsByMatch = await slots.listForTournament(tournamentId);
  for (const match of activeMatches) {
    if (!slotsByMatch.get(match.id)?.length) {
      await slots.ensureNext(crypto.randomUUID(), tournamentId, match.id, 1, match.roomHash, now);
    }
  }
  if (activeMatches.some((m) => !slotsByMatch.get(m.id)?.length)) {
    slotsByMatch = await slots.listForTournament(tournamentId);
  }

  const relevantNames = new Set([...slotsByMatch.values()].flat().flatMap((s) => candidateGameNames(s.currentRoomHash)));

  const claimed = await fetchLog.claim(`tournament:${slug}`, now, FETCH_CACHE_MS);
  if (claimed) {
    const token = await findAnyLinkedNexusToken();
    if (token) {
      const replays = await fetchNexusReplayList(token);
      if (replays) {
        for (const replay of replays) {
          if (relevantNames.has(replay.gameName)) await replayCache.upsertSummary(replay, now);
        }
      }
    }
  }

  // Detail-fetch pass: anything relevant that get-info.php has told us about
  // but get-replay-info.php hasn't been called for yet - independent of
  // whether *this* pass won the list-fetch claim above, since it's already
  // deduplicated per replay id (see the winning_team IS NULL check).
  for (const cached of await replayCache.listByGameNames([...relevantNames])) {
    if (cached.winningTeam !== null) continue;
    const details = await fetchNexusReplayDetails(cached.replayId);
    if (details) await replayCache.fetchDetails(cached.replayId, details, now);
  }

  const registrationIds = [...new Set(activeMatches.flatMap((m) => [m.player1.registrationId, m.player2.registrationId]))];
  const regInfo = await repos(pool).registrations.listForNexusMatching(registrationIds);

  const attemptsByTournament = await attempts.listForTournament(tournamentId);
  const consumedReplayIds = new Set(
    [...attemptsByTournament.values()].flat().map((a) => a.replayId).filter((id): id is string => id !== null),
  );

  for (const match of activeMatches) {
    await processMatch(match, slug, tournamentId, regInfo, slotsByMatch, consumedReplayIds, event.matchFormat, now, pool);
  }
}

/** Every tournament with a match currently open - what event-listing polling sweeps, same shape as closeAllOverdueMatches(). Best-effort per tournament so one failure can't block the rest. */
export async function verifyAllActiveTournaments(): Promise<void> {
  const slugs = await new TournamentBracketsRepository(getPool()).listSlugsWithBracket();
  for (const slug of slugs) {
    await verifyTournament(slug).catch(() => null);
  }
}
