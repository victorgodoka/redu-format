import { Manager } from "tournament-organizer/components";
import type { Tournament as EngineTournament } from "tournament-organizer/components";
import type { ExportedTournamentValues } from "tournament-organizer/interfaces";
import type { Structure, TournamentEvent } from "../../events.ts";
import { getPool } from "../db/client.ts";
import { MatchDeadlinesRepository, type MatchTracking } from "../repositories/match-deadlines.repository.ts";
import { MatchReportsRepository, type MatchReport, type MatchResult } from "../repositories/match-reports.repository.ts";
import { PlacingsRepository, type Placing } from "../repositories/placings.repository.ts";
import { TournamentBracketsRepository } from "../repositories/tournament-brackets.repository.ts";
import { TournamentsRepository } from "../repositories/tournaments.repository.ts";
import { RegistrationsRepository } from "../repositories/registrations.repository.ts";
import { generateNexusRoomHash } from "./nexus-room.ts";

/** Winning a top cut (stage two) match is worth this many extra leaderboard points, on top of the normal match score. */
const TOP_CUT_MATCH_BONUS = 5;

export type BracketPlayer = { registrationId: string; name: string; win: number; loss: number; draw: number };

export type BracketMatch = {
  id: string;
  round: number;
  active: boolean;
  bye: boolean;
  hasResult: boolean;
  player1: BracketPlayer | null;
  player2: BracketPlayer | null;
  /** ISO instant this match is force-closed at, or null if it isn't open (yet, or anymore). */
  deadlineAt: string | null;
  /** The Dueling Nexus room hash (`duelingnexus.com/duel/NA-{hash}`), or null for a bye/not-yet-paired match. */
  roomHash: string | null;
  /** Self-reports currently on file for this match - normally 0 or 1 while waiting, briefly 2 when they disagree. */
  reports: { registrationId: string; result: MatchResult }[];
  /** Both sides reported, but their reports don't reconcile - needs a mod to enter the real result. */
  disputed: boolean;
};

export type BracketStanding = {
  registrationId: string;
  name: string;
  points: number;
  matchesPlayed: number;
  dropped: boolean;
};

export type BracketView = {
  status: "setup" | "stage-one" | "stage-two" | "complete";
  round: number;
  format: Structure;
  topCutFormat: "single-elimination" | "double-elimination" | "stepladder" | null;
  matches: BracketMatch[];
  standings: BracketStanding[];
};

function repos() {
  const pool = getPool();
  return {
    brackets: new TournamentBracketsRepository(pool),
    placings: new PlacingsRepository(pool),
    tournaments: new TournamentsRepository(pool),
    registrations: new RegistrationsRepository(pool),
    matchReports: new MatchReportsRepository(pool),
    matchDeadlines: new MatchDeadlinesRepository(pool),
  };
}

/**
 * Records `now` as the deadline clock's start, and generates a Dueling Nexus
 * room hash, for any match that just became active and doesn't have either
 * yet. Call after every engine mutation that might open new matches.
 *
 * Only one engine exists today (Dueling Nexus), so every new match gets a
 * hash unconditionally - branch on the tournament's `engine` field here once
 * a second one exists.
 */
async function syncMatchDeadlines(tournamentId: string, engine: EngineTournament): Promise<void> {
  const activeMatchIds = engine
    .getMatches()
    .filter((m) => m.isActive())
    .map((m) => m.getId());
  await repos().matchDeadlines.ensureActiveSince(tournamentId, activeMatchIds, new Date(), () => generateNexusRoomHash());
}

function reportsAgree(a: MatchResult, b: MatchResult): boolean {
  if (a === "draw" || b === "draw") return a === "draw" && b === "draw";
  // One win + one loss agree on who won; both win or both loss are a conflict.
  return a !== b;
}

/** Enters the real result from a single honored report - used both when both sides' reports agree, and when only one side ever reported and the deadline forces a call. */
function enterFromReport(engine: EngineTournament, matchId: string, reporterId: string, result: MatchResult): void {
  if (result === "draw") {
    engine.enterResult(matchId, 0, 0, 1);
    return;
  }
  const reporterIsP1 = engine.getMatch(matchId).getPlayer1().id === reporterId;
  const reporterWon = result === "win";
  const p1Won = reporterIsP1 ? reporterWon : !reporterWon;
  engine.enterResult(matchId, p1Won ? 1 : 0, p1Won ? 0 : 1, 0);
}

/**
 * Force-resolves a match whose round deadline has passed. Exactly one side
 * reported: that report is honored as-is, since the silent side had their
 * chance. Otherwise (nobody reported, or both did but never reconciled into
 * an agreed result) there's no honest signal to go on.
 *
 * Elimination formats need a real winner to advance the bracket - the engine
 * refuses a 0-0 "draw" mid-elimination - so this defaults to player1; rare in
 * practice and always fixable by a mod afterward. Swiss has no such
 * constraint, so this is recorded as a genuine double loss: both players get
 * 0 points, not the 1-point draw the engine's own (0,0,0) entry would
 * otherwise silently credit (see doubleLossPenalty).
 *
 * Returns who showed up and who didn't, for the caller to feed into each
 * player's consecutive-absence streak.
 */
function resolveOverdueMatch(
  engine: EngineTournament,
  match: ReturnType<EngineTournament["getMatch"]>,
  reports: MatchReport[],
): { absentIds: string[]; presentIds: string[] } {
  const p1Id = match.getPlayer1().id!;
  const p2Id = match.getPlayer2().id!;
  const p1Report = reports.find((r) => r.registrationId === p1Id);
  const p2Report = reports.find((r) => r.registrationId === p2Id);

  if (p1Report && !p2Report) {
    enterFromReport(engine, match.getId(), p1Id, p1Report.result);
    return { absentIds: [p2Id], presentIds: [p1Id] };
  }
  if (p2Report && !p1Report) {
    enterFromReport(engine, match.getId(), p2Id, p2Report.result);
    return { absentIds: [p1Id], presentIds: [p2Id] };
  }
  if (engine.isElimination()) {
    engine.enterResult(match.getId(), 1, 0, 0);
  } else {
    engine.enterResult(match.getId(), 0, 0, 0);
    match.set({ meta: { doubleLoss: true } });
  }
  // Both reported (but disputed, never reconciled) - both showed up, neither is "absent".
  // Neither reported - nobody showed up, both are.
  return p1Report && p2Report ? { absentIds: [], presentIds: [p1Id, p2Id] } : { absentIds: [p1Id, p2Id], presentIds: [] };
}

/**
 * Points the engine wrongly credits for a double-loss match: it has no native
 * double-loss concept, so resolveOverdueMatch's (0,0,0) entry falls into its
 * "draw" scoring branch and both sides get scoring.draw points instead of
 * zero. Subtracted wherever a player's match points are read.
 */
function doubleLossPenalty(engine: EngineTournament, registrationId: string): number {
  const player = engine.getPlayers().find((p) => p.getId() === registrationId);
  if (!player) return 0;
  const count = player.getMatches().filter((m) => engine.getMatch(m.id).getMeta().doubleLoss === true).length;
  return count * engine.getScoring().draw;
}

function toStageOneFormat(structure: Structure): "swiss" | "single-elimination" | "double-elimination" {
  if (structure === "single-elim") return "single-elimination";
  if (structure === "double-elim") return "double-elimination";
  return "swiss";
}

async function loadEngine(tournamentId: string): Promise<EngineTournament | null> {
  const values = await repos().brackets.get(tournamentId);
  if (!values) return null;
  return new Manager().loadTournament(values);
}

async function persistEngine(tournamentId: string, engine: EngineTournament): Promise<void> {
  await repos().brackets.save(tournamentId, engine.getValues() as ExportedTournamentValues);
}

/** The deadline that actually governs a match: Staff's override if they extended it, otherwise the normal activeSince + roundLimitDays computation. */
function effectiveDeadline(t: MatchTracking, cutoffMs: number): Date {
  return t.deadlineOverride ?? new Date(t.activeSince.getTime() + cutoffMs);
}

function toView(
  engine: EngineTournament,
  format: Structure,
  roundLimitDays: number,
  tracking: Map<string, MatchTracking>,
  reports: MatchReport[],
): BracketView {
  const playersById = new Map(engine.getPlayers().map((p) => [p.getId(), p]));
  const cutoffMs = roundLimitDays * 24 * 60 * 60 * 1000;
  const reportsByMatch = new Map<string, MatchReport[]>();
  for (const r of reports) {
    if (!reportsByMatch.has(r.matchId)) reportsByMatch.set(r.matchId, []);
    reportsByMatch.get(r.matchId)!.push(r);
  }

  const matches: BracketMatch[] = engine.getMatches().map((m) => {
    const p1 = m.getPlayer1();
    const p2 = m.getPlayer2();
    const toBracketPlayer = (p: typeof p1): BracketPlayer | null =>
      p.id
        ? { registrationId: p.id, name: playersById.get(p.id)?.getName() ?? "?", win: p.win, loss: p.loss, draw: p.draw }
        : null;
    const matchReports = reportsByMatch.get(m.getId()) ?? [];
    const matchTracking = tracking.get(m.getId());
    return {
      id: m.getId(),
      round: m.getRoundNumber(),
      active: m.isActive(),
      bye: m.isBye(),
      // A double loss (see resolveOverdueMatch) leaves every win/loss/draw field
      // at 0, which is indistinguishable from "not played yet" to hasEnded().
      hasResult: Boolean(m.hasEnded()) || m.getMeta().doubleLoss === true,
      player1: toBracketPlayer(p1),
      player2: toBracketPlayer(p2),
      deadlineAt: matchTracking ? effectiveDeadline(matchTracking, cutoffMs).toISOString() : null,
      roomHash: matchTracking?.roomHash ?? null,
      reports: matchReports.map((r) => ({ registrationId: r.registrationId, result: r.result })),
      disputed: matchReports.length === 2 && !reportsAgree(matchReports[0].result, matchReports[1].result),
    };
  });

  const standings: BracketStanding[] = rankByOfficialTiebreak(
    engine,
    engine.getStandings().map((s) => ({
      registrationId: s.player.getId(),
      name: s.player.getName(),
      points: s.matchPoints - doubleLossPenalty(engine, s.player.getId()),
      matchesPlayed: s.matches,
      dropped: !s.player.isActive(),
    })),
  );

  const stageTwoFormat = engine.getStageTwo().format;

  return {
    status: engine.getStatus(),
    round: engine.getRoundNumber(),
    format,
    topCutFormat: stageTwoFormat,
    matches,
    standings,
  };
}

/**
 * Extra points for winning a top cut match, beyond the normal 3/1/0 already
 * counted in matchPoints - stage two rounds are numbered right after stage
 * one's, so anything past stageOne.rounds is a top cut match.
 */
function topCutBonus(engine: EngineTournament, registrationId: string): number {
  if (engine.getStageTwo().format === null) return 0;
  const stageOneRounds = engine.getStageOne().rounds;
  const wins = engine
    .getMatches()
    .filter((m) => m.getRoundNumber() > stageOneRounds && m.getWinner()?.id === registrationId).length;
  return wins * TOP_CUT_MATCH_BONUS;
}

/**
 * Match-win percentage for the official tiebreaker (a player's own, and each
 * opponent's, feeding into BBB/CCC below) - wins over matches played, with a
 * draw counted as a loss per the official rule (not half a win, unlike the
 * engine's own default matchWinPct). Floored at 1/3: the standard fix (also
 * used by Magic's near-identical OMW%/GWP% system) so an opponent who got a
 * bye or dropped early doesn't drag everyone who played them down further
 * than an actual loss would have.
 */
function matchWinPercent(engine: EngineTournament, registrationId: string): number {
  const player = engine.getPlayers().find((p) => p.getId() === registrationId);
  const matches = player?.getMatches() ?? [];
  if (matches.length === 0) return 1 / 3;
  const wins = matches.filter((m) => m.win > m.loss).length;
  return Math.max(wins / matches.length, 1 / 3);
}

/** The distinct opponents a player actually faced (byes and their own no-opponent placeholder matches excluded). */
function opponentsOf(engine: EngineTournament, registrationId: string): string[] {
  const player = engine.getPlayers().find((p) => p.getId() === registrationId);
  if (!player) return [];
  return [...new Set(player.getMatches().map((m) => m.opponent).filter((id): id is string => id !== null))];
}

/**
 * The official YCS/Regional tiebreaker, composed as a single sortable number
 * mirroring the AABBBCCCDDD format: AA total points, BBB opponents'
 * match-win% (to the tenth of a percent), CCC opponents'-opponents'
 * match-win%, DDD the sum of the squares of the rounds actually lost (draws
 * don't count here - only a real loss). Wider digit gaps than a literal
 * 2-3-3-3 split are used since this is a ranking score, not a display
 * string - safe for any realistic round count.
 */
function officialTiebreakScore(engine: EngineTournament, registrationId: string, points: number): number {
  const opponentIds = opponentsOf(engine, registrationId);
  const oppWinPct = opponentIds.length
    ? opponentIds.reduce((sum, id) => sum + matchWinPercent(engine, id), 0) / opponentIds.length
    : 0;
  const oppOppWinPct = opponentIds.length
    ? opponentIds.reduce((sum, id) => {
        const oppOpponentIds = opponentsOf(engine, id);
        const avg = oppOpponentIds.length
          ? oppOpponentIds.reduce((s, oid) => s + matchWinPercent(engine, oid), 0) / oppOpponentIds.length
          : 0;
        return sum + avg;
      }, 0) / opponentIds.length
    : 0;

  const lossRoundsSquaredSum = engine
    .getMatches()
    .filter((m) => {
      const side =
        m.getPlayer1().id === registrationId ? m.getPlayer1() : m.getPlayer2().id === registrationId ? m.getPlayer2() : null;
      return side !== null && side.loss > side.win;
    })
    .reduce((sum, m) => sum + m.getRoundNumber() ** 2, 0);

  const BBB = Math.round(oppWinPct * 1000);
  const CCC = Math.round(oppOppWinPct * 1000);
  return points * 1e10 + BBB * 1e6 + CCC * 1e3 + lossRoundsSquaredSum;
}

/** Ranks entries by the official tiebreaker, highest first; identical tiebreakers (rare) fall back to alphabetical by name, per the official rule. */
function rankByOfficialTiebreak<T extends { registrationId: string; name: string; points: number }>(
  engine: EngineTournament,
  entries: T[],
): T[] {
  return [...entries].sort((a, b) => {
    const scoreDiff =
      officialTiebreakScore(engine, b.registrationId, b.points) - officialTiebreakScore(engine, a.registrationId, a.points);
    return scoreDiff !== 0 ? scoreDiff : a.name.localeCompare(b.name);
  });
}

export async function hasBracket(slug: string): Promise<boolean> {
  const tournamentId = await repos().tournaments.findIdBySlug(slug);
  if (!tournamentId) return false;
  return repos().brackets.exists(tournamentId);
}

export async function getBracketView(slug: string): Promise<BracketView | null> {
  const { tournaments, matchDeadlines, matchReports } = repos();
  const [tournamentId, event] = await Promise.all([tournaments.findIdBySlug(slug), tournaments.findBySlug(slug)]);
  if (!tournamentId || !event) return null;

  const engine = await loadEngine(tournamentId);
  if (!engine) return null;

  const [tracking, reports] = await Promise.all([
    matchDeadlines.getTrackingMap(tournamentId),
    matchReports.listForTournament(tournamentId),
  ]);

  return toView(engine, event.structure, event.roundLimitDays, tracking, reports);
}

/**
 * Starts a bracket from the tournament's current registrations - every row in
 * `registrations` for this tournament becomes a player, public signup and
 * admin manual alike (matches how they're already unified everywhere else).
 * Throws if there's already a bracket, or too few registrations.
 */
export async function startBracket(slug: string, event: TournamentEvent): Promise<void> {
  const { tournaments, brackets, registrations } = repos();
  const tournamentId = await tournaments.findIdBySlug(slug);
  if (!tournamentId) throw new Error(`Tournament "${slug}" does not exist`);
  if (event.status !== "scheduled") throw new Error(`Tournament "${slug}" can't be started from its current status`);
  if (await brackets.exists(tournamentId)) throw new Error(`Tournament "${slug}" already has a bracket`);

  const participants = await registrations.findByTournamentSlug(slug);
  const minPlayers = event.structure === "double-elim" ? 4 : 2;
  if (participants.length < minPlayers) {
    throw new Error(`Need at least ${minPlayers} registered participants to start`);
  }

  const engine = new Manager().createTournament(event.name, {
    seating: false,
    sorting: "none",
    scoring: {
      bestOf: event.matchFormat === "Bo3" ? 3 : 1,
      win: 3,
      draw: 1,
      loss: 0,
      bye: 3,
      // Approximates the official Konami tiebreak order (opponents' match-win %,
      // then opponents' opponents' match-win %) for the engine's *internal*
      // seeding of the stage-two (Top Cut) bracket, which always calls
      // getStandings() itself - see Tournament.nextRound() in tournament-organizer.
      // Without this the engine had no tiebreaks configured, so ties fell back to
      // player ID order when seeding Top Cut. This is an approximation, not the
      // real formula: the engine's own OMW%/OOMW% skip the 1/3 floor and there's
      // no DDD (rounds-lost) tiebreak here. The exact official formula - floor
      // included - already lives in officialTiebreakScore() below and drives the
      // actual displayed standings and final placings; it just can't reach into
      // the engine's own bracket-seeding step.
      tiebreaks: ["opponent match win percentage", "opponent opponent match win percentage"],
    },
    stageOne: {
      format: toStageOneFormat(event.structure),
      rounds: event.structure === "swiss" ? event.rounds : 0,
      initialRound: 1,
    },
    stageTwo:
      event.structure === "swiss" && event.topCut
        ? { format: "single-elimination", advance: { value: event.topCut, method: "rank" } }
        : { format: null },
  }, tournamentId);

  for (const participant of participants) {
    engine.createPlayer(participant.name, participant.id);
  }

  engine.startTournament();
  await persistEngine(tournamentId, engine);
  await syncMatchDeadlines(tournamentId, engine);
  // Marks the tournament as actually started - separate from startsAt, since
  // staff can (and did) start a bracket ahead of the advertised time. This is
  // what the public site checks to stop calling it "upcoming".
  await tournaments.markStarted(tournamentId, new Date().toISOString());
}

export async function generateNextRound(slug: string): Promise<void> {
  const tournamentId = await repos().tournaments.findIdBySlug(slug);
  if (!tournamentId) throw new Error(`Tournament "${slug}" does not exist`);
  const engine = await loadEngine(tournamentId);
  if (!engine) throw new Error(`Tournament "${slug}" has no bracket yet`);

  engine.nextRound();
  await persistEngine(tournamentId, engine);
  await syncMatchDeadlines(tournamentId, engine);
}

/**
 * Admin override: enters or replaces a result directly, regardless of what
 * (if anything) players have self-reported for this match - clearing those
 * reports afterward so a stale disagreement doesn't linger once a mod has
 * settled it. This is also how a disputed match gets resolved.
 *
 * Only reachable for the match's own round: once any match in a later round
 * has been paired, that round has "started" and everything before it is
 * locked - no retroactive correction once play has moved on. A round can't
 * advance while one of its own matches is still disputed, so this never
 * blocks a genuine first-time resolution, only a correction attempted too late.
 */
export async function enterMatchResult(
  slug: string,
  matchId: string,
  player1Wins: number,
  player2Wins: number,
  draws = 0,
): Promise<void> {
  const tournamentId = await repos().tournaments.findIdBySlug(slug);
  if (!tournamentId) throw new Error(`Tournament "${slug}" does not exist`);
  const engine = await loadEngine(tournamentId);
  if (!engine) throw new Error(`Tournament "${slug}" has no bracket yet`);

  const match = engine.getMatch(matchId);
  const nextRoundStarted = engine
    .getMatches()
    .some((m) => m.getRoundNumber() > match.getRoundNumber() && m.isPaired());
  if (nextRoundStarted) {
    throw new Error("This match's round has already closed - the next round has started, so its result can no longer be changed.");
  }

  // Rewriting an already-decided match (a self-report resolution or an earlier
  // override) has to go through clearResult() first - it's what unwinds any
  // elimination-bracket progression the old result already caused, so the
  // correction propagates forward cleanly instead of double-advancing anyone.
  if (match.hasEnded()) {
    engine.clearResult(matchId);
  }
  const { id: matchP1Id } = engine.getMatch(matchId).getPlayer1();
  const { id: matchP2Id } = engine.getMatch(matchId).getPlayer2();
  engine.enterResult(matchId, player1Wins, player2Wins, draws);
  await persistEngine(tournamentId, engine);
  await repos().matchReports.clearForMatch(matchId);
  await repos().registrations.resetAbsences([matchP1Id, matchP2Id].filter((id): id is string => id !== null));
  await syncMatchDeadlines(tournamentId, engine);
}

/**
 * Drops a registration that's already in a started bracket - called by
 * registration.service.ts's dropRegistration() once it knows the pre-start,
 * delete-the-row path doesn't apply. If they currently have an unresolved
 * match, it's settled first (a real loss for them, exactly like a round-
 * deadline no-show) before they're deactivated for every round after it.
 */
export async function dropFromStartedTournament(slug: string, registrationId: string): Promise<void> {
  const tournamentId = await repos().tournaments.findIdBySlug(slug);
  if (!tournamentId) throw new Error(`Tournament "${slug}" does not exist`);
  const engine = await loadEngine(tournamentId);
  if (!engine) throw new Error(`Tournament "${slug}" has no bracket yet`);
  if (engine.getStatus() === "complete") throw new Error("This tournament has already finished");

  const player = engine.getPlayers().find((p) => p.getId() === registrationId);
  if (!player || !player.isActive()) return; // already gone, nothing to do

  const activeMatch = engine
    .getMatches()
    .find((m) => m.isActive() && (m.getPlayer1().id === registrationId || m.getPlayer2().id === registrationId));

  if (activeMatch && engine.getStatus() === "stage-one" && engine.getStageOne().format === "swiss") {
    // Swiss's removePlayer() doesn't resolve an in-progress match on its own (only
    // elimination formats do) - assignLoss() settles this round for the dropped
    // player (their opponent gets the automatic win) before removePlayer() takes
    // them out of every round after it.
    engine.assignLoss(registrationId, activeMatch.getRoundNumber());
  }
  // Elimination: removePlayer() alone both resolves any active match (a real loss,
  // their opponent advances) and deactivates them for the rest of the bracket.
  engine.removePlayer(registrationId);

  await persistEngine(tournamentId, engine);
  await repos().registrations.markDropped(registrationId);
  if (activeMatch) await repos().matchReports.clearForMatch(activeMatch.getId());
  await syncMatchDeadlines(tournamentId, engine);
}

/**
 * Player self-report. A match resolves the moment both sides' reports agree;
 * if they conflict (both claim win, both claim loss, or a draw mismatched
 * against a win/loss) it's left disputed for a mod to resolve via
 * enterMatchResult - the round can't advance past it until then, since it
 * still shows up as an unresolved active match.
 */
export async function submitMatchReport(
  slug: string,
  matchId: string,
  registrationId: string,
  result: MatchResult,
): Promise<void> {
  const { tournaments, matchReports } = repos();
  const tournamentId = await tournaments.findIdBySlug(slug);
  if (!tournamentId) throw new Error(`Tournament "${slug}" does not exist`);
  const engine = await loadEngine(tournamentId);
  if (!engine) throw new Error(`Tournament "${slug}" has no bracket yet`);

  const match = engine.getMatch(matchId);
  if (!match.isActive()) throw new Error("This match isn't open for reporting");
  const p1Id = match.getPlayer1().id;
  const p2Id = match.getPlayer2().id;
  if (registrationId !== p1Id && registrationId !== p2Id) throw new Error("You're not in this match");

  await matchReports.submit(tournamentId, matchId, registrationId, result);

  const reports = await matchReports.listForMatch(matchId);
  const mine = reports.find((r) => r.registrationId === registrationId)!;
  const theirs = reports.find((r) => r.registrationId !== registrationId);
  if (!theirs || !reportsAgree(mine.result, theirs.result)) return;

  enterFromReport(engine, matchId, registrationId, mine.result);
  await persistEngine(tournamentId, engine);
  await matchReports.clearForMatch(matchId);
  await repos().registrations.resetAbsences([p1Id, p2Id].filter((id): id is string => id !== null));
  await syncMatchDeadlines(tournamentId, engine);
}

/**
 * Force-closes every match in this tournament whose round deadline has
 * passed - meant to be called from the round-deadline cron, once per
 * tournament with an open bracket. Also advances the swiss round once every
 * match in it has a result (elimination matches never need this: the
 * engine's own enterResult() already advances the bracket one match at a
 * time as each is resolved).
 */
export async function closeOverdueMatches(slug: string): Promise<{ resolved: number }> {
  const { tournaments, matchDeadlines, matchReports } = repos();
  const [tournamentId, event] = await Promise.all([tournaments.findIdBySlug(slug), tournaments.findBySlug(slug)]);
  if (!tournamentId || !event) return { resolved: 0 };

  const engine = await loadEngine(tournamentId);
  if (!engine || engine.getStatus() === "setup" || engine.getStatus() === "complete") {
    return { resolved: 0 };
  }

  const tracking = await matchDeadlines.getTrackingMap(tournamentId);
  const cutoffMs = event.roundLimitDays * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const overdue = engine.getMatches().filter((m) => {
    const t = tracking.get(m.getId());
    return m.isActive() && t !== undefined && now >= effectiveDeadline(t, cutoffMs).getTime();
  });
  if (overdue.length === 0) return { resolved: 0 };

  const reportsByMatch = new Map<string, MatchReport[]>();
  for (const r of await matchReports.listForTournament(tournamentId)) {
    if (!reportsByMatch.has(r.matchId)) reportsByMatch.set(r.matchId, []);
    reportsByMatch.get(r.matchId)!.push(r);
  }

  for (const match of overdue) {
    const { absentIds, presentIds } = resolveOverdueMatch(engine, match, reportsByMatch.get(match.getId()) ?? []);
    await matchReports.clearForMatch(match.getId());
    await repos().registrations.resetAbsences(presentIds);

    for (const registrationId of absentIds) {
      const streak = await repos().registrations.incrementAbsences(registrationId);
      if (streak < 2) continue;
      // Missed two rounds in a row - auto-dropped. This round's result is already
      // settled above; this only takes them out of every round after it.
      const player = engine.getPlayers().find((p) => p.getId() === registrationId);
      if (player?.isActive()) {
        engine.removePlayer(registrationId);
        await repos().registrations.markDropped(registrationId);
      }
    }
  }

  if (engine.getStatus() === "stage-one") {
    try {
      engine.nextRound();
    } catch {
      // Other stage-one matches are still within their own deadline, so the round
      // isn't done yet - nothing more to do until they resolve too.
    }
  }

  await persistEngine(tournamentId, engine);
  await syncMatchDeadlines(tournamentId, engine);
  return { resolved: overdue.length };
}

/**
 * Extends the deadline of every currently-active match by `extraHours`, on
 * top of whatever deadline currently governs it (the normal computation, or
 * an earlier extension) - e.g. the duel engine went down for a day. Since
 * "active right now" and "the round in progress" are the same set of matches
 * (a round can't advance while any of its matches are still open), this
 * naturally only ever touches the current round, never a past or future one.
 */
export async function extendCurrentRoundDeadline(slug: string, extraHours: number): Promise<{ extended: number }> {
  const { tournaments, matchDeadlines } = repos();
  const [tournamentId, event] = await Promise.all([tournaments.findIdBySlug(slug), tournaments.findBySlug(slug)]);
  if (!tournamentId || !event) throw new Error(`Tournament "${slug}" does not exist`);

  const engine = await loadEngine(tournamentId);
  if (!engine) throw new Error(`Tournament "${slug}" has no bracket yet`);

  const activeMatches = engine.getMatches().filter((m) => m.isActive());
  if (activeMatches.length === 0) return { extended: 0 };

  const tracking = await matchDeadlines.getTrackingMap(tournamentId);
  const cutoffMs = event.roundLimitDays * 24 * 60 * 60 * 1000;
  const extraMs = extraHours * 60 * 60 * 1000;

  const updates = activeMatches
    .map((m) => {
      const t = tracking.get(m.getId());
      if (!t) return null;
      return { matchId: m.getId(), until: new Date(effectiveDeadline(t, cutoffMs).getTime() + extraMs) };
    })
    .filter((u): u is { matchId: string; until: Date } => u !== null);

  await matchDeadlines.extendDeadlines(tournamentId, updates);
  return { extended: updates.length };
}

/** Sweeps every tournament with an open bracket - what the round-deadline cron route calls. Best-effort per tournament so one bad one can't block the rest. */
export async function closeAllOverdueMatches(): Promise<{ slug: string; resolved: number; error?: string }[]> {
  const slugs = await repos().brackets.listSlugsWithBracket();
  const results = [];
  for (const slug of slugs) {
    try {
      results.push({ slug, ...(await closeOverdueMatches(slug)) });
    } catch (err) {
      results.push({ slug, resolved: 0, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return results;
}

/**
 * The global leaderboard's placement-based formula (docs/fluxo-do-torneio.md
 * §15) - flat by finishing place, not scaled by field size or match points
 * earned. Marked as a starting proposal there, still subject to validation.
 */
function rankingPointsForPlace(place: number): number {
  if (place === 1) return 100;
  if (place === 2) return 75;
  if (place <= 4) return 50;
  if (place <= 8) return 25;
  if (place <= 16) return 10;
  return 5;
}

/** Ends the bracket (if not already ended by the library itself) and freezes final placings for the leaderboard. */
export async function completeBracket(slug: string): Promise<void> {
  const { tournaments } = repos();
  const [tournamentId, event] = await Promise.all([tournaments.findIdBySlug(slug), tournaments.findBySlug(slug)]);
  if (!tournamentId || !event) throw new Error(`Tournament "${slug}" does not exist`);
  if (event.status === "cancelled") {
    throw new Error(`Tournament "${slug}" was cancelled - it can't generate placings`);
  }
  const engine = await loadEngine(tournamentId);
  if (!engine) throw new Error(`Tournament "${slug}" has no bracket yet`);

  if (engine.getStatus() !== "complete") {
    engine.endTournament();
  }

  const ranked = rankByOfficialTiebreak(
    engine,
    engine.getStandings().map((s) => ({
      registrationId: s.player.getId(),
      name: s.player.getName(),
      points: s.matchPoints + topCutBonus(engine, s.player.getId()) - doubleLossPenalty(engine, s.player.getId()),
    })),
  );
  const placings: Placing[] = ranked.map((r, index) => ({
    registrationId: r.registrationId,
    place: index + 1,
    points: r.points,
    rankingPoints: rankingPointsForPlace(index + 1),
  }));

  await repos().placings.replaceForTournament(tournamentId, placings);
  await persistEngine(tournamentId, engine);
  await repos().tournaments.markFinished(tournamentId, new Date().toISOString());
}

export async function getPlacings(slug: string) {
  const tournamentId = await repos().tournaments.findIdBySlug(slug);
  if (!tournamentId) return [];
  return repos().placings.listForTournament(tournamentId);
}

export async function getLeaderboard(limit = 50) {
  return repos().placings.leaderboard(limit);
}

/** slug -> final placing, for every completed tournament this player has a real result in. */
export async function getPlacingsForPlayer(playerId: string): Promise<Map<string, { place: number; points: number }>> {
  const rows = await repos().placings.listForPlayer(playerId);
  return new Map(rows.map((r) => [r.slug, { place: r.place, points: r.points }]));
}

export type MyMatchView = {
  matchId: string;
  round: number;
  opponentName: string | null;
  myReport: MatchResult | null;
  opponentReported: boolean;
  disputed: boolean;
  deadlineAt: string | null;
  roomHash: string | null;
};

/** The signed-in player's current open match in this tournament, for the player-facing report UI - null if they have none right now (not registered, bye, between rounds, or the event hasn't started). */
export async function getMyCurrentMatch(slug: string, registrationId: string): Promise<MyMatchView | null> {
  const { tournaments, matchDeadlines, matchReports } = repos();
  const [tournamentId, event] = await Promise.all([tournaments.findIdBySlug(slug), tournaments.findBySlug(slug)]);
  if (!tournamentId || !event) return null;

  const engine = await loadEngine(tournamentId);
  if (!engine) return null;

  const match = engine
    .getMatches()
    .find((m) => m.isActive() && (m.getPlayer1().id === registrationId || m.getPlayer2().id === registrationId));
  if (!match) return null;

  const opponentId = match.getPlayer1().id === registrationId ? match.getPlayer2().id : match.getPlayer1().id;
  const opponent = opponentId ? engine.getPlayers().find((p) => p.getId() === opponentId) : undefined;

  const reports = await matchReports.listForMatch(match.getId());
  const mine = reports.find((r) => r.registrationId === registrationId);
  const theirs = reports.find((r) => r.registrationId !== registrationId);

  const matchTracking = (await matchDeadlines.getTrackingMap(tournamentId)).get(match.getId());
  const deadlineAt = matchTracking
    ? new Date(matchTracking.activeSince.getTime() + event.roundLimitDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  return {
    matchId: match.getId(),
    round: match.getRoundNumber(),
    opponentName: opponent?.getName() ?? null,
    myReport: mine?.result ?? null,
    opponentReported: Boolean(theirs),
    disputed: Boolean(mine && theirs && !reportsAgree(mine.result, theirs.result)),
    deadlineAt,
    roomHash: matchTracking?.roomHash ?? null,
  };
}

export type MyMatchHistoryEntry = {
  round: number;
  opponentName: string | null;
  result: "win" | "loss" | "draw" | "bye";
  score: string;
};

/** Every finished round this player has played in this tournament, oldest first - the "your duels" list on the event page. */
export async function getMyMatchHistory(slug: string, registrationId: string): Promise<MyMatchHistoryEntry[]> {
  const tournamentId = await repos().tournaments.findIdBySlug(slug);
  if (!tournamentId) return [];
  const engine = await loadEngine(tournamentId);
  if (!engine) return [];

  const player = engine.getPlayers().find((p) => p.getId() === registrationId);
  if (!player) return [];

  const entries: MyMatchHistoryEntry[] = [];
  for (const m of player.getMatches()) {
    const match = engine.getMatch(m.id);
    if (match.isActive()) continue; // still open - that's getMyCurrentMatch's job, not history

    const opponent = m.opponent ? engine.getPlayers().find((p) => p.getId() === m.opponent) : undefined;
    const result: MyMatchHistoryEntry["result"] = match.isBye()
      ? "bye"
      : m.win > m.loss
        ? "win"
        : m.loss > m.win
          ? "loss"
          : "draw";
    entries.push({
      round: match.getRoundNumber(),
      opponentName: opponent?.getName() ?? null,
      result,
      score: `${m.win}-${m.loss}`,
    });
  }
  return entries.sort((a, b) => a.round - b.round);
}

/** Test seam. */
export async function resetResultsData(): Promise<void> {
  const { brackets, placings, matchReports, matchDeadlines } = repos();
  await brackets.clear();
  await placings.clear();
  await matchReports.clear();
  await matchDeadlines.clear();
}
