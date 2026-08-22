import { Manager } from "tournament-organizer/components";
import type { Tournament as EngineTournament } from "tournament-organizer/components";
import type { ExportedTournamentValues } from "tournament-organizer/interfaces";
import type { Structure, TournamentEvent } from "../../events.ts";
import { getPool } from "../db/client.ts";
import { MatchDeadlinesRepository, type MatchTracking } from "../repositories/match-deadlines.repository.ts";
import { MatchFlagsRepository, type MatchFlag } from "../repositories/match-flags.repository.ts";
import { MatchReportsRepository, type MatchReport, type MatchResult } from "../repositories/match-reports.repository.ts";
import { PlacingsRepository, type Placing } from "../repositories/placings.repository.ts";
import { TournamentBracketsRepository } from "../repositories/tournament-brackets.repository.ts";
import { TournamentsRepository } from "../repositories/tournaments.repository.ts";
import { RegistrationsRepository } from "../repositories/registrations.repository.ts";
import { generateNexusRoomHash } from "./nexus-room.ts";
import { enforceTournamentDecks, lockTournamentDecks } from "./deck-watch.service.ts";
import { roundClock, roundCutoffMs, shouldAutoAdvance, type RoundClock } from "../../rounds.ts";

/** What a locked round rejects a report with - the same wording the player-facing notice carries. */
export const ROUND_LOCKED_MESSAGE =
  "This round is locked - reporting is closed. Contact a Tournament Organizer if something is wrong.";

/** Winning a top cut (stage two) match is worth this many extra leaderboard points, on top of the normal match score. */
const TOP_CUT_MATCH_BONUS = 5;

/** How long into a match before its players can call a no-show on each other. */
export const NO_SHOW_AVAILABLE_AFTER_MS = 3 * 60 * 1000;

/** How long an unanswered no-show stands before it hands the match to whoever called it. Same-day tournaments only. */
export const NO_SHOW_GRACE_MS = 5 * 60 * 1000;

/** Two no-shows that stuck and you are out of the tournament. */
const NO_SHOW_DQ_LIMIT = 2;

/** Games the winner needs, by match format - there are no draws, so a series always has one. */
export function winningGames(matchFormat: "Bo1" | "Bo3"): number {
  return matchFormat === "Bo3" ? 2 : 1;
}

export type BracketPlayer = { registrationId: string; name: string; win: number; loss: number; draw: number };

/**
 * Which half of a double-elimination bracket a match belongs to. null for
 * every other format, where there is only one bracket to be in.
 */
export type MatchBracket = "winners" | "losers" | "grand-final" | null;

export type BracketMatch = {
  id: string;
  round: number;
  bracket: MatchBracket;
  /** Human name for this match's round - "Winners Round 2", "Losers Final", "Grand Final Reset", "Round 3". */
  label: string;
  active: boolean;
  bye: boolean;
  hasResult: boolean;
  player1: BracketPlayer | null;
  player2: BracketPlayer | null;
  /** ISO instant this match is force-closed at, or null if it isn't open (yet, or anymore). */
  deadlineAt: string | null;
  /** The Dueling Nexus room hash (`duelingnexus.com/duel/NA-{hash}`), or null for a bye/not-yet-paired match. */
  roomHash: string | null;
  /** Who called this match, and with what score. One report settles it, so this is normally 0 or 1 entries. */
  reports: { registrationId: string; result: MatchResult; winnerGames: number; loserGames: number }[];
  /** The series score as played, e.g. "2-1" - null until the match is settled. */
  score: string | null;
  /** An open no-show call on this match: the bracket shows it in red until it is dismissed or it decides the match. */
  noShow: {
    reporterRegistrationId: string;
    targetRegistrationId: string | null;
    /** When the accused loses automatically. Null in a long-duration tournament, which waits for a moderator. */
    autoResolvesAt: string | null;
  } | null;
  /** A player asked a moderator to look at the result on file. */
  contested: boolean;
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
  /** How many stage-one (Swiss) rounds this bracket has - anything past it is Top Cut. */
  stageOneRounds: number;
  /** Timer/lock state of the round in progress, derived from persisted deadlines. */
  clock: RoundClock;
  /** Games that win a series here - 2 in a Bo3, 1 in a Bo1. There are no draws. */
  winningGames: number;
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
    matchFlags: new MatchFlagsRepository(pool),
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

/**
 * Writes a settled series into the engine from one side's point of view.
 * There are no draws here: somebody won, and the games say how comfortably.
 */
function enterFromReport(
  engine: EngineTournament,
  matchId: string,
  reporterId: string,
  reporterWon: boolean,
  winnerGames = 1,
  loserGames = 0,
): void {
  const reporterIsP1 = engine.getMatch(matchId).getPlayer1().id === reporterId;
  const p1Won = reporterIsP1 ? reporterWon : !reporterWon;
  engine.enterResult(
    matchId,
    p1Won ? winnerGames : loserGames,
    p1Won ? loserGames : winnerGames,
    0,
  );
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
  noShow?: MatchFlag,
): { absentIds: string[]; presentIds: string[] } {
  const p1Id = match.getPlayer1().id!;
  const p2Id = match.getPlayer2().id!;
  const p1Report = reports.find((r) => r.registrationId === p1Id);
  const p2Report = reports.find((r) => r.registrationId === p2Id);

  // Nobody reported a result, but somebody did say their opponent never
  // turned up - the round closing is what finally settles that call.
  if (!p1Report && !p2Report && noShow) {
    enterFromReport(engine, match.getId(), noShow.reporterRegistrationId, true);
    const absent = noShow.targetRegistrationId;
    return {
      absentIds: absent ? [absent] : [],
      presentIds: [noShow.reporterRegistrationId],
    };
  }

  if (p1Report && !p2Report) {
    enterFromReport(engine, match.getId(), p1Id, p1Report.result === "win", p1Report.winnerGames, p1Report.loserGames);
    return { absentIds: [p2Id], presentIds: [p1Id] };
  }
  if (p2Report && !p1Report) {
    enterFromReport(engine, match.getId(), p2Id, p2Report.result === "win", p2Report.winnerGames, p2Report.loserGames);
    return { absentIds: [p1Id], presentIds: [p2Id] };
  }
  if (engine.isElimination()) {
    engine.enterResult(match.getId(), 1, 0, 0);
  } else {
    engine.enterResult(match.getId(), 0, 0, 0);
    match.set({ meta: { doubleLoss: true } });
  }
  // Both reported - both showed up, neither is "absent".
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

/**
 * Reads the winners/losers structure straight off the match graph the engine
 * builds when a double-elimination bracket starts, rather than off round
 * numbers (which interleave the two halves: with 8 players the winners rounds
 * are 1-3, the grand final is 4, and the losers rounds are 5-8).
 *
 * The graph says it plainly. Every match carries where its winner and its
 * loser go next:
 * - a loser who still has somewhere to go is dropping out of the winners
 *   bracket, so `path.loss !== null` means this is a winners match;
 * - in the losers bracket a loss is elimination, so `path.loss === null`
 *   while `path.win` still points somewhere;
 * - the grand final is the one match with nowhere to send either player.
 *
 * The library adds a second grand-final match when the losers-bracket player
 * wins it (both sides then have one loss) - that is the reset, and it is the
 * later of the two by match number.
 */
function eliminationRounds(engine: EngineTournament): Map<number, { phase: RoundPhase; roundLabel: string }> {
  const labels = new Map<number, { phase: RoundPhase; roundLabel: string }>();
  if (engine.getStageOne().format !== "double-elimination") return labels;

  const rounds = (side: (path: { win: string | null; loss: string | null }) => boolean) =>
    [
      ...new Set(
        engine
          .getMatches()
          .filter((m) => side(m.getPath()))
          .map((m) => m.getRoundNumber()),
      ),
    ].sort((a, b) => a - b);

  const winners = rounds((path) => path.loss !== null);
  const losers = rounds((path) => path.loss === null && path.win !== null);
  const finals = rounds((path) => path.loss === null && path.win === null);

  winners.forEach((round, i) => {
    labels.set(round, {
      phase: "winners",
      roundLabel: i === winners.length - 1 ? "Winners Final" : `Winners Round ${i + 1}`,
    });
  });
  losers.forEach((round, i) => {
    labels.set(round, {
      phase: "losers",
      roundLabel: i === losers.length - 1 ? "Losers Final" : `Losers Round ${i + 1}`,
    });
  });
  for (const round of finals) labels.set(round, { phase: "grandFinal", roundLabel: "Grand Final" });

  return labels;
}

/** Bracket side per match id, plus the grand-final reset, which shares its round number with the grand final itself. */
function eliminationMatches(engine: EngineTournament): Map<string, { bracket: MatchBracket; label: string }> {
  const byMatch = new Map<string, { bracket: MatchBracket; label: string }>();
  const rounds = eliminationRounds(engine);
  if (rounds.size === 0) return byMatch;

  const finals = engine
    .getMatches()
    .filter((m) => m.getPath().win === null && m.getPath().loss === null)
    .sort((a, b) => a.getMatchNumber() - b.getMatchNumber());

  for (const match of engine.getMatches()) {
    const round = rounds.get(match.getRoundNumber());
    if (!round) continue;
    const bracket: MatchBracket =
      round.phase === "winners" ? "winners" : round.phase === "losers" ? "losers" : "grand-final";
    // A second grand final only exists when the losers-bracket player took the
    // first one off the (until then) undefeated finalist - the reset.
    const isReset = bracket === "grand-final" && finals.length > 1 && match.getId() !== finals[0].getId();
    byMatch.set(match.getId(), { bracket, label: isReset ? "Grand Final Reset" : round.roundLabel });
  }
  return byMatch;
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
  event: TournamentEvent,
  tracking: Map<string, MatchTracking>,
  reports: MatchReport[],
  flags: MatchFlag[] = [],
): BracketView {
  const playersById = new Map(engine.getPlayers().map((p) => [p.getId(), p]));
  const cutoffMs = roundCutoffMs(event);
  const reportsByMatch = new Map<string, MatchReport[]>();
  for (const r of reports) {
    if (!reportsByMatch.has(r.matchId)) reportsByMatch.set(r.matchId, []);
    reportsByMatch.get(r.matchId)!.push(r);
  }

  const eliminationLabels = eliminationMatches(engine);
  const flagsByMatch = new Map<string, MatchFlag[]>();
  for (const f of flags) {
    if (!flagsByMatch.has(f.matchId)) flagsByMatch.set(f.matchId, []);
    flagsByMatch.get(f.matchId)!.push(f);
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
    const elimination = eliminationLabels.get(m.getId());
    return {
      id: m.getId(),
      round: m.getRoundNumber(),
      bracket: elimination?.bracket ?? null,
      label: elimination?.label ?? describeRound(engine, m.getRoundNumber()).roundLabel,
      active: m.isActive(),
      bye: m.isBye(),
      // A double loss (see resolveOverdueMatch) leaves every win/loss/draw field
      // at 0, which is indistinguishable from "not played yet" to hasEnded().
      hasResult: Boolean(m.hasEnded()) || m.getMeta().doubleLoss === true,
      player1: toBracketPlayer(p1),
      player2: toBracketPlayer(p2),
      deadlineAt: matchTracking ? effectiveDeadline(matchTracking, cutoffMs).toISOString() : null,
      roomHash: matchTracking?.roomHash ?? null,
      reports: matchReports.map((r) => ({
        registrationId: r.registrationId,
        result: r.result,
        winnerGames: r.winnerGames,
        loserGames: r.loserGames,
      })),
      score: m.hasEnded() && !m.isBye() ? `${p1.win}-${p2.win}` : null,
      noShow: (() => {
        const flag = flagsByMatch.get(m.getId())?.find((f) => f.kind === "no_show");
        return flag
          ? {
              reporterRegistrationId: flag.reporterRegistrationId,
              targetRegistrationId: flag.targetRegistrationId,
              autoResolvesAt: flag.autoResolvesAt?.toISOString() ?? null,
            }
          : null;
      })(),
      contested: Boolean(flagsByMatch.get(m.getId())?.some((f) => f.kind === "contest")),
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
    stageOneRounds: engine.getStageOne().rounds,
    clock: clockFor(event, engine, tracking),
    winningGames: winningGames(event.matchFormat),
    format: event.structure,
    topCutFormat: stageTwoFormat,
    matches,
    standings,
  };
}

/**
 * What "the round in progress" actually means, which is not the same thing in
 * both formats:
 *
 * - Swiss pairs a whole round at once and advances in lockstep, so it is every
 *   match carrying the engine's current round number.
 * - An elimination bracket (a whole single/double-elim event, or a Top Cut)
 *   builds its entire match graph up front and advances one match at a time as
 *   results come in - `getRoundNumber()` stays on the first round for the whole
 *   event, and a double-elim bracket's round numbers interleave the winners and
 *   losers halves rather than running in chronological order. There, the round
 *   in progress is simply whatever is open right now.
 */
function currentRoundMatches(engine: EngineTournament): ReturnType<EngineTournament["getMatches"]> {
  if (engine.isElimination()) return engine.getMatches().filter((m) => m.isActive());
  const round = engine.getRoundNumber();
  return engine.getMatches().filter((m) => m.getRoundNumber() === round);
}

/**
 * The deadline that governs the round in progress: the latest of its own
 * matches' deadlines, so a Staff extension of one match holds the whole round
 * open rather than locking it out from under them. Null when nothing is open
 * (the bracket hasn't started, or has run out of matches).
 */
function currentRoundDeadline(
  engine: EngineTournament,
  tracking: Map<string, MatchTracking>,
  cutoffMs: number,
): Date | null {
  const deadlines = currentRoundMatches(engine)
    .map((m) => tracking.get(m.getId()))
    .filter((t): t is MatchTracking => t !== undefined)
    .map((t) => effectiveDeadline(t, cutoffMs).getTime());
  return deadlines.length ? new Date(Math.max(...deadlines)) : null;
}

/**
 * True once nothing in the current round is still open to report. Swiss only:
 * in an elimination bracket "no open match" means the next one hasn't been
 * paired yet (or the bracket is over), never that reporting should close - each
 * match is governed by its own deadline instead.
 */
function roundFullyResolved(engine: EngineTournament): boolean {
  if (engine.isElimination()) return false;
  const round = engine.getRoundNumber();
  const matches = engine.getMatches().filter((m) => m.getRoundNumber() === round);
  return matches.length > 0 && matches.every((m) => !m.isActive());
}

/** Whether this specific match is past its own deadline - the check that governs an elimination bracket, where matches open and close independently. */
function matchIsOverdue(
  matchId: string,
  tracking: Map<string, MatchTracking>,
  cutoffMs: number,
  now: Date = new Date(),
): boolean {
  const t = tracking.get(matchId);
  return t !== undefined && now.getTime() >= effectiveDeadline(t, cutoffMs).getTime();
}

/**
 * Round lock state, computed from persisted timestamps only - never from a
 * client clock, and it survives a refresh, a closed tab, or a cron that
 * hasn't fired yet.
 */
function clockFor(
  event: TournamentEvent,
  engine: EngineTournament,
  tracking: Map<string, MatchTracking>,
  now: Date = new Date(),
): RoundClock {
  return roundClock(event, {
    deadlineAt: currentRoundDeadline(engine, tracking, roundCutoffMs(event)),
    allMatchesResolved: roundFullyResolved(engine),
    now,
  });
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
/** Average match-win% across a set of registration ids - 0 for an empty set (no opponents played yet). */
function avgMatchWinPercent(engine: EngineTournament, ids: string[]): number {
  return ids.length ? ids.reduce((sum, id) => sum + matchWinPercent(engine, id), 0) / ids.length : 0;
}

function officialTiebreakScore(engine: EngineTournament, registrationId: string, points: number): number {
  const opponentIds = opponentsOf(engine, registrationId);
  const oppWinPct = avgMatchWinPercent(engine, opponentIds);
  const oppOppWinPct = opponentIds.length
    ? opponentIds.reduce((sum, id) => sum + avgMatchWinPercent(engine, opponentsOf(engine, id)), 0) / opponentIds.length
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

/**
 * Who is out of a running bracket, for the public participant list. Three
 * ways to be out: the engine no longer has you active (a drop, an auto-drop,
 * or a DQ), you lost enough elimination matches (one in single elim and Top
 * Cut, two in double elim), or Swiss ended and you didn't make the cut.
 *
 * Pure - derived from the view the page already loaded, no extra query.
 */
export function eliminatedRegistrationIds(view: BracketView): Set<string> {
  const out = new Set(view.standings.filter((s) => s.dropped).map((s) => s.registrationId));

  const losses = new Map<string, number>();
  for (const m of view.matches) {
    if (!m.hasResult || m.bye || !m.player1 || !m.player2) continue;
    // Swiss losses cost points, not your place in the event - only elimination
    // rounds (a whole elim bracket, or a Top Cut round) knock anyone out.
    if (view.format === "swiss" && m.round <= view.stageOneRounds) continue;
    const loser = m.player1.win > m.player2.win ? m.player2 : m.player2.win > m.player1.win ? m.player1 : null;
    if (loser) losses.set(loser.registrationId, (losses.get(loser.registrationId) ?? 0) + 1);
  }
  const allowed = view.format === "double-elim" ? 2 : 1;
  for (const [registrationId, count] of losses) {
    if (count >= allowed) out.add(registrationId);
  }

  // Once the Top Cut is under way, everyone who isn't in it is done playing.
  if (view.status === "stage-two") {
    const inCut = new Set(
      view.matches
        .filter((m) => m.round > view.stageOneRounds)
        .flatMap((m) => [m.player1?.registrationId, m.player2?.registrationId]),
    );
    for (const s of view.standings) {
      if (!inCut.has(s.registrationId)) out.add(s.registrationId);
    }
  }

  return out;
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

  const [tracking, reports, flags] = await Promise.all([
    matchDeadlines.getTrackingMap(tournamentId),
    matchReports.listForTournament(tournamentId),
    repos().matchFlags.listOpen(tournamentId),
  ]);

  return toView(engine, event, tracking, reports, flags);
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
  // The deck each player holds *right now* becomes the only legal list for the
  // rest of this tournament - changes made before this instant are not
  // violations. Awaited rather than fired and forgotten: a floating promise
  // does not reliably survive the end of a serverless request.
  await lockTournamentDecks(slug);
}

export async function generateNextRound(slug: string): Promise<void> {
  const tournamentId = await repos().tournaments.findIdBySlug(slug);
  if (!tournamentId) throw new Error(`Tournament "${slug}" does not exist`);
  const engine = await loadEngine(tournamentId);
  if (!engine) throw new Error(`Tournament "${slug}" has no bracket yet`);

  engine.nextRound();
  await persistEngine(tournamentId, engine);
  await syncMatchDeadlines(tournamentId, engine);
  await enforceTournamentDecks(slug);
}

function decidedDescendants(engine: EngineTournament, matchId: string): ReturnType<EngineTournament["getMatch"]>[] {
  const decided: ReturnType<EngineTournament["getMatch"]>[] = [];
  const seen = new Set<string>([matchId]);
  const queue = [matchId];
  while (queue.length > 0) {
    const path = engine.getMatch(queue.shift()!).getPath();
    for (const nextId of [path.win, path.loss]) {
      if (!nextId || seen.has(nextId)) continue;
      seen.add(nextId);
      const next = engine.getMatch(nextId);
      if (next.hasEnded()) {
        decided.push(next);
        queue.push(nextId);
      }
    }
  }
  return decided;
}

export class RepairConfirmationRequired extends Error {
  readonly affectedMatchIds: string[];

  constructor(affectedMatchIds: string[]) {
    super(
      `Changing the winner here voids ${affectedMatchIds.length} already-played match${affectedMatchIds.length === 1 ? "" : "es"} further into the bracket - whoever really advances hasn't played them yet. Confirm to void ${affectedMatchIds.length === 1 ? "it" : "them"} and proceed.`,
    );
    this.name = "RepairConfirmationRequired";
    this.affectedMatchIds = affectedMatchIds;
  }
}

/**
 * Admin override: enters or replaces a result directly, regardless of what
 * (if anything) players have self-reported for this match - clearing those
 * reports afterward so a stale disagreement doesn't linger once a mod has
 * settled it. This is also how a contested result gets put right.
 *
 * The round-lock only applies to *correcting* a match that already has a
 * result - once any match in a later round has been paired off the back of
 * it, that correction is refused. A first-time entry is always allowed
 * regardless: in an elimination bracket, entering one quarterfinal's result
 * can pair up the semifinal before its sibling quarterfinals have been
 * entered at all - those siblings are still fresh, first-time entries for
 * their own round, not late corrections, and must not be blocked by that
 * pairing side effect.
 *
 * A correction that keeps the same winner (fixing a 2-0 to a 2-1, say) never
 * needs any of this: standings and bracket progression both key off which
 * side won, never the game count, so it's applied directly regardless of what
 * has happened downstream. A correction that changes the winner after
 * downstream matches were already played is a repair, not a patch - see
 * decidedDescendants() and `opts.confirm`.
 */
export async function enterMatchResult(
  slug: string,
  matchId: string,
  player1Wins: number,
  player2Wins: number,
  draws = 0,
  opts: { confirm?: boolean } = {},
): Promise<void> {
  const tournamentId = await repos().tournaments.findIdBySlug(slug);
  if (!tournamentId) throw new Error(`Tournament "${slug}" does not exist`);
  const engine = await loadEngine(tournamentId);
  if (!engine) throw new Error(`Tournament "${slug}" has no bracket yet`);

  const match = engine.getMatch(matchId);

  if (match.hasEnded()) {
    const p1Id = match.getPlayer1().id;
    const p2Id = match.getPlayer2().id;
    const existingWinnerId = match.getWinner()?.id ?? null;
    const intendedWinnerId = player1Wins > player2Wins ? p1Id : player2Wins > player1Wins ? p2Id : null;

    if (existingWinnerId !== null && existingWinnerId === intendedWinnerId) {
      // Same winner, different score. Write it directly instead of routing
      // through clearResult()/enterResult(), which would reopen - and, since
      // that pair doesn't check whether what it's reopening has itself
      // already been decided, silently corrupt - any match this one already
      // fed a winner or loser into.
      match.set({
        player1: { win: player1Wins, loss: player2Wins, draw: draws },
        player2: { win: player2Wins, loss: player1Wins, draw: draws },
      });
      if (p1Id) engine.getPlayer(p1Id).updateMatch(matchId, { win: player1Wins, loss: player2Wins, draw: draws });
      if (p2Id) engine.getPlayer(p2Id).updateMatch(matchId, { win: player2Wins, loss: player1Wins, draw: draws });
      await persistEngine(tournamentId, engine);
      await repos().matchReports.clearForMatch(matchId);
      await repos().registrations.resetAbsences([p1Id, p2Id].filter((id): id is string => id !== null));
      await syncMatchDeadlines(tournamentId, engine);
      return;
    }

    // The winner is actually changing. What makes that unsafe is a
    // *downstream* result, not a bigger round number - see decidedDescendants().
    const downstream = decidedDescendants(engine, matchId);
    if (downstream.length > 0) {
      if (!engine.isElimination()) {
        // Swiss has no bracket graph to repair through - its pairings are
        // just recomputed each round, so there's nothing to selectively void.
        throw new Error(
          "This match's round has already closed - the next round has started, so its result can no longer be changed.",
        );
      }
      if (!opts.confirm) throw new RepairConfirmationRequired(downstream.map((m) => m.getId()));

      // Void every match this correction invalidates, deepest (highest round
      // number) first, so nothing is cleared while something it feeds into
      // still holds a stale result - tournament-organizer's clearResult()
      // doesn't check that itself. The target is cleared last, then
      // re-decided below, letting the engine's own propagation re-seat
      // whoever really advances into the now-freshly-opened matches.
      for (const m of [...downstream].sort((a, b) => b.getRoundNumber() - a.getRoundNumber())) {
        engine.clearResult(m.getId());
        await repos().matchReports.clearForMatch(m.getId());
      }
    } else if (!engine.isElimination() && engine.getRoundNumber() > match.getRoundNumber()) {
      throw new Error("This match's round has already closed - the next round has started, so its result can no longer be changed.");
    }
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
  if (!player || !player.isActive()) {
    // Nothing to take out of the bracket - either they were never in it (added
    // or registered after it started) or they are already out of it. The
    // registration still has to be marked, or the drop looks like it did
    // nothing at all: the row keeps showing as an active participant and
    // pressing the button again changes nothing.
    await repos().registrations.markDropped(registrationId);
    return;
  }

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
 * Player self-report, and the only thing needed to settle a duel: one side
 * says who won and with what score, and the match is done. The other side
 * does not have to confirm anything - they see the report, and if it is wrong
 * they raise it with a moderator (contestMatchResult), who can rewrite the
 * result freely.
 *
 * There are no draws: a series always has a winner. `winnerGames`/`loserGames`
 * are the series score (2-1 in a Bo3, 1-0 in a Bo1).
 */
export async function submitMatchReport(
  slug: string,
  matchId: string,
  registrationId: string,
  won: boolean,
  winnerGames?: number,
  loserGames = 0,
): Promise<void> {
  const { tournaments, matchReports, matchDeadlines } = repos();
  const [tournamentId, event] = await Promise.all([tournaments.findIdBySlug(slug), tournaments.findBySlug(slug)]);
  if (!tournamentId || !event) throw new Error(`Tournament "${slug}" does not exist`);
  const engine = await loadEngine(tournamentId);
  if (!engine) throw new Error(`Tournament "${slug}" has no bracket yet`);

  // The lock is enforced here, not just hidden in the UI: a round is closed
  // the moment its persisted deadline passes, whether or not the cron has run
  // and whatever the browser believes.
  const tracking = await matchDeadlines.getTrackingMap(tournamentId);
  // Two ways a report is too late: the round itself is locked (Swiss, where a
  // round closes as a block), or this match's own deadline has passed (an
  // elimination bracket, where each match runs on its own clock).
  if (clockFor(event, engine, tracking).locked || matchIsOverdue(matchId, tracking, roundCutoffMs(event))) {
    throw new Error(ROUND_LOCKED_MESSAGE);
  }

  const match = engine.getMatch(matchId);
  if (!match.isActive()) throw new Error("This match isn't open for reporting");
  const p1Id = match.getPlayer1().id;
  const p2Id = match.getPlayer2().id;
  if (registrationId !== p1Id && registrationId !== p2Id) throw new Error("You're not in this match");

  // A series can only be won by the format's game count, and the loser can
  // never have matched it - anything else is a typed-in impossibility.
  const needed = winningGames(event.matchFormat);
  const winner = winnerGames ?? needed;
  if (winner !== needed || loserGames < 0 || loserGames >= needed) {
    throw new Error(`A ${event.matchFormat} series is won ${needed}-0${needed > 1 ? ` or ${needed}-${needed - 1}` : ""}`);
  }

  await matchReports.submit(tournamentId, matchId, registrationId, won ? "win" : "loss", winner, loserGames);

  // One report settles it. The record of who called it stays on the row so the
  // other player can see it and contest it if it is wrong.
  enterFromReport(engine, matchId, registrationId, won, winner, loserGames);
  await persistEngine(tournamentId, engine);
  await repos().registrations.resetAbsences([p1Id, p2Id].filter((id): id is string => id !== null));
  // Reporting is showing up: any no-show call on this match is moot now.
  await repos().matchFlags.dismiss(matchId, "no_show", "result reported");
  await syncMatchDeadlines(tournamentId, engine);
}

/**
 * The other player disagrees with the result on file. Nothing changes in the
 * bracket - it flags the match and hands a moderator everything they need to
 * rule on it, since a moderator can rewrite any result.
 */
export async function contestMatchResult(slug: string, matchId: string, registrationId: string): Promise<void> {
  const { tournaments, matchReports, matchFlags } = repos();
  const [tournamentId, event] = await Promise.all([tournaments.findIdBySlug(slug), tournaments.findBySlug(slug)]);
  if (!tournamentId || !event) throw new Error(`Tournament "${slug}" does not exist`);
  const engine = await loadEngine(tournamentId);
  if (!engine) throw new Error(`Tournament "${slug}" has no bracket yet`);

  const match = engine.getMatch(matchId);
  const p1Id = match.getPlayer1().id;
  const p2Id = match.getPlayer2().id;
  if (registrationId !== p1Id && registrationId !== p2Id) throw new Error("You're not in this match");

  await matchFlags.raise({
    tournamentId,
    matchId,
    kind: "contest",
    reporterRegistrationId: registrationId,
    targetRegistrationId: null,
    autoResolvesAt: null,
  });

  const nameOf = (id: string | null) => engine.getPlayers().find((p) => p.getId() === id)?.getName() ?? "?";
  const report = (await matchReports.listForMatch(matchId))[0];
  const label = eliminationMatches(engine).get(matchId)?.label ?? describeRound(engine, match.getRoundNumber()).roundLabel;

  await notifyAdmins({
    kind: "match.contested",
    title: `Result contested - ${nameOf(registrationId)} in ${event.name}`,
    body: [
      `Tournament: ${event.name} (${slug}), ${event.structure}, ${event.matchFormat}`,
      `Round: ${label}`,
      `Players: ${nameOf(p1Id)} vs ${nameOf(p2Id)}`,
      `Contested by: ${nameOf(registrationId)}`,
      report
        ? `Result on file: ${nameOf(report.registrationId)} reported a ${report.result} at ${report.winnerGames}-${report.loserGames}`
        : "Result on file: none - nobody has reported this match",
      `Manage: /admin/tournaments/${slug}/bracket`,
    ].join("\n"),
    fingerprint: `contest|${matchId}|${registrationId}`,
  });
}

/**
 * Force-closes every match in this tournament whose round deadline has
 * passed - meant to be called from the round-deadline cron, once per
 * tournament with an open bracket. Also advances the swiss round once every
 * match in it has a result (elimination matches never need this: the
 * engine's own enterResult() already advances the bracket one match at a
 * time as each is resolved).
 */
export async function closeOverdueMatches(slug: string): Promise<{ resolved: number; advanced: boolean }> {
  const { tournaments, matchDeadlines, matchReports } = repos();
  const [tournamentId, event] = await Promise.all([tournaments.findIdBySlug(slug), tournaments.findBySlug(slug)]);
  if (!tournamentId || !event) return { resolved: 0, advanced: false };

  // A no-show whose grace ran out decides its match before anything else is
  // measured - it may be what closes the round, so it runs before the engine
  // is read.
  await resolveDueNoShows(new Date(), tournamentId);

  const engine = await loadEngine(tournamentId);
  if (!engine || engine.getStatus() === "setup" || engine.getStatus() === "complete") {
    return { resolved: 0, advanced: false };
  }

  const tracking = await matchDeadlines.getTrackingMap(tournamentId);
  const cutoffMs = roundCutoffMs(event);
  const nowDate = new Date();
  const now = nowDate.getTime();
  const clock = clockFor(event, engine, tracking, nowDate);

  const overdue = engine.getMatches().filter((m) => {
    const t = tracking.get(m.getId());
    return m.isActive() && t !== undefined && now >= effectiveDeadline(t, cutoffMs).getTime();
  });
  // Nothing to force-close, and no cleanup window has run out - the round is
  // still being played.
  if (overdue.length === 0 && !shouldAutoAdvance(clock, nowDate)) return { resolved: 0, advanced: false };

  const reportsByMatch = new Map<string, MatchReport[]>();
  for (const r of await matchReports.listForTournament(tournamentId)) {
    if (!reportsByMatch.has(r.matchId)) reportsByMatch.set(r.matchId, []);
    reportsByMatch.get(r.matchId)!.push(r);
  }
  const openFlags = await repos().matchFlags.listOpen(tournamentId);

  for (const match of overdue) {
    const noShow = openFlags.find((f) => f.kind === "no_show" && f.matchId === match.getId());
    const { absentIds, presentIds } = resolveOverdueMatch(
      engine,
      match,
      reportsByMatch.get(match.getId()) ?? [],
      noShow,
    );
    if (noShow) await repos().matchFlags.resolve(match.getId(), "no_show");
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

  // A long-duration tournament never pairs a round on its own: once the
  // current one locks it simply waits for a moderator. A same-day one
  // advances by itself, but only after the cleanup window - which a moderator
  // can cut short with generateNextRound().
  let advanced = false;
  if (engine.getStatus() === "stage-one" && shouldAutoAdvance(clock, nowDate)) {
    try {
      engine.nextRound();
      advanced = true;
    } catch {
      // Other stage-one matches are still within their own deadline, so the round
      // isn't done yet - nothing more to do until they resolve too.
    }
  }

  await persistEngine(tournamentId, engine);
  await syncMatchDeadlines(tournamentId, engine);
  if (advanced) await enforceTournamentDecks(slug);
  return { resolved: overdue.length, advanced };
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
  const cutoffMs = roundCutoffMs(event);
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
export async function closeAllOverdueMatches(): Promise<
  { slug: string; resolved: number; advanced?: boolean; error?: string }[]
> {
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

export type PlacingWithTiebreak = Awaited<ReturnType<typeof getPlacings>>[number] & {
  wins: number;
  losses: number;
  draws: number;
  /** 0-1, same figures that decided this placement - see officialTiebreakScore. */
  omw: number;
  oomw: number;
};

/**
 * Final standings enriched with the win/loss record and OMW%/OOMW% figures
 * that actually decided the placements - recomputed from the persisted
 * bracket state rather than stored alongside it, so they can never drift
 * from what officialTiebreakScore used at completion time.
 */
export async function getPlacingsWithTiebreak(slug: string): Promise<PlacingWithTiebreak[]> {
  const placings = await getPlacings(slug);
  if (placings.length === 0) return [];

  const tournamentId = await repos().tournaments.findIdBySlug(slug);
  const engine = tournamentId ? await loadEngine(tournamentId) : null;
  if (!engine) return placings.map((p) => ({ ...p, wins: 0, losses: 0, draws: 0, omw: 0, oomw: 0 }));

  return placings.map((p) => {
    const matches = engine.getPlayers().find((pl) => pl.getId() === p.registrationId)?.getMatches() ?? [];
    const wins = matches.filter((m) => m.win > m.loss).length;
    const losses = matches.filter((m) => m.loss > m.win).length;
    const draws = matches.length - wins - losses;

    const opponentIds = opponentsOf(engine, p.registrationId);
    const omw = avgMatchWinPercent(engine, opponentIds);
    const oomw = opponentIds.length
      ? opponentIds.reduce((sum, id) => sum + avgMatchWinPercent(engine, opponentsOf(engine, id)), 0) / opponentIds.length
      : 0;

    return { ...p, wins, losses, draws, omw, oomw };
  });
}

export async function getLeaderboard(limit = 50) {
  return repos().placings.leaderboard(limit);
}

/** slug -> final placing, for every completed tournament this player has a real result in. */
export async function getPlacingsForPlayer(playerId: string): Promise<Map<string, { place: number; points: number }>> {
  const rows = await repos().placings.listForPlayer(playerId);
  return new Map(rows.map((r) => [r.slug, { place: r.place, points: r.points }]));
}

export type RoundPhase = "swiss" | "topCut" | "winners" | "losers" | "grandFinal";

/**
 * Doc section 11: Top Cut rounds are numbered right after Swiss ones by the
 * engine, with nothing distinguishing the two - this turns a raw round
 * number into the phase it's actually in, and a bracket-round name for Top
 * Cut (Quarterfinal, Semifinal, Final) instead of just the next number.
 */
function describeRound(engine: EngineTournament, roundNumber: number): { phase: RoundPhase; roundLabel: string } {
  // A double-elimination bracket has no "round N of the tournament" to speak
  // of - every round belongs to one half of the bracket or is the grand final.
  const elimination = eliminationRounds(engine).get(roundNumber);
  if (elimination) return elimination;

  const stageOneRounds = engine.getStageOne().rounds;
  if (roundNumber <= stageOneRounds) {
    return { phase: "swiss", roundLabel: `Round ${roundNumber}` };
  }

  const cutSize = engine.getStageTwo().advance.value;
  const cutRounds = cutSize > 0 ? Math.ceil(Math.log2(cutSize)) : 0;
  const roundsLeft = cutRounds - (roundNumber - stageOneRounds);
  const name =
    roundsLeft <= 0
      ? "Final"
      : roundsLeft === 1
        ? "Semifinal"
        : roundsLeft === 2
          ? "Quarterfinal"
          : `Round of ${2 ** (roundsLeft + 1)}`;
  return { phase: "topCut", roundLabel: `Top Cut · ${name}` };
}

export type MyMatchView = {
  matchId: string;
  round: number;
  phase: RoundPhase;
  roundLabel: string;
  opponentName: string | null;
  myReport: MatchResult | null;
  /** The score on file, from whoever reported: e.g. "2-1". Null while nothing is reported. */
  reportedScore: string | null;
  /** True when the report on file is the opponent's, so this player is the one who can contest it. */
  reportedByOpponent: boolean;
  /** A moderator has been asked to look at this result. */
  contested: boolean;
  /** How many games win the series in this tournament - 2 for Bo3, 1 for Bo1. */
  winningGames: number;
  /** An open no-show call on this match, and who it names. */
  noShow: { byMe: boolean; againstMe: boolean; autoResolvesAt: string | null } | null;
  /** The no-show button only appears a few minutes in - this is when it does. */
  noShowAvailableAt: string | null;
  /** Whether that moment has arrived, decided here rather than by whatever clock the browser has. */
  canReportNoShow: boolean;
  deadlineAt: string | null;
  roomHash: string | null;
  /** Reporting is closed for this round - the UI must say why, and the server rejects a report regardless. */
  locked: boolean;
  /** Same-day tournaments only: when the next round starts by itself. */
  nextRoundAt: string | null;
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
  const onFile = mine ?? theirs;

  const flags = (await repos().matchFlags.listOpen(tournamentId)).filter((f) => f.matchId === match.getId());
  const noShowFlag = flags.find((f) => f.kind === "no_show");

  const tracking = await matchDeadlines.getTrackingMap(tournamentId);
  const matchTracking = tracking.get(match.getId());
  const deadlineAt = matchTracking ? effectiveDeadline(matchTracking, roundCutoffMs(event)).toISOString() : null;
  const clock = clockFor(event, engine, tracking);

  return {
    matchId: match.getId(),
    round: match.getRoundNumber(),
    ...describeRound(engine, match.getRoundNumber()),
    opponentName: opponent?.getName() ?? null,
    myReport: mine?.result ?? null,
    reportedScore: onFile ? `${onFile.winnerGames}-${onFile.loserGames}` : null,
    reportedByOpponent: Boolean(theirs) && !mine,
    contested: Boolean(flags.find((f) => f.kind === "contest")),
    winningGames: winningGames(event.matchFormat),
    noShow: noShowFlag
      ? {
          byMe: noShowFlag.reporterRegistrationId === registrationId,
          againstMe: noShowFlag.targetRegistrationId === registrationId,
          autoResolvesAt: noShowFlag.autoResolvesAt?.toISOString() ?? null,
        }
      : null,
    noShowAvailableAt: matchTracking
      ? new Date(matchTracking.activeSince.getTime() + NO_SHOW_AVAILABLE_AFTER_MS).toISOString()
      : null,
    canReportNoShow: Boolean(
      matchTracking && !noShowFlag && Date.now() - matchTracking.activeSince.getTime() >= NO_SHOW_AVAILABLE_AFTER_MS,
    ),
    deadlineAt,
    roomHash: matchTracking?.roomHash ?? null,
    locked: clock.locked || matchIsOverdue(match.getId(), tracking, roundCutoffMs(event)),
    nextRoundAt: clock.nextRoundAt,
  };
}

/**
 * What this player is doing in the round that's open right now. "match" is
 * the only state with something to report; the other three exist so a player
 * is never left staring at an empty page wondering whether the site forgot
 * about them:
 *
 * - `bye` - they drew the odd seat this round: an automatic win, no duel, no
 *   report.
 * - `waiting` - they're still in, but have no pairing in this round (their
 *   duel is settled and the round hasn't turned over yet, or the bracket
 *   hasn't paired them for the next phase).
 * - `out` - they dropped, were auto-dropped, or were knocked out.
 */
export type MyRoundState = "match" | "bye" | "waiting" | "out";

export type MyRoundView = {
  state: MyRoundState;
  round: number;
  phase: RoundPhase;
  roundLabel: string;
  /** Reporting is closed for this round - true for every state, since the lock is a property of the round, not of one player. */
  locked: boolean;
  nextRoundAt: string | null;
  /** Only set for `state: "match"`. */
  match: MyMatchView | null;
  /**
   * What this player already has on the board for *this* round - the bye they
   * were given, or the duel they finished while the round is still open.
   * Deliberately not folded into the match history: a bye is part of the round
   * being played, not a past result, and reading it off the history list is
   * how it ends up looking like it belongs to some other round.
   */
  settled: MyMatchHistoryEntry | null;
};

/**
 * The player's whole current-round picture, for the event page and the
 * dashboard alike - both render it through components/site/MyRound. Null when
 * they aren't in this bracket at all (never registered, or the tournament has
 * no bracket yet).
 */
export async function getMyRound(slug: string, registrationId: string): Promise<MyRoundView | null> {
  const { tournaments, matchDeadlines } = repos();
  const [tournamentId, event] = await Promise.all([tournaments.findIdBySlug(slug), tournaments.findBySlug(slug)]);
  if (!tournamentId || !event) return null;

  const engine = await loadEngine(tournamentId);
  if (!engine) return null;

  const player = engine.getPlayers().find((p) => p.getId() === registrationId);
  if (!player) return null;

  const round = engine.getRoundNumber();
  const clock = clockFor(event, engine, await matchDeadlines.getTrackingMap(tournamentId));
  // Everything this player has settled in the round that's open right now -
  // a bye counts, and belongs here rather than in the history list.
  const thisRound = player
    .getMatches()
    .filter((m) => {
      const match = engine.getMatch(m.id);
      // Settled only: a duel still being played is the "match" state's business.
      return match.getRoundNumber() === round && !match.isActive();
    })
    .map((m) => toOutcome(engine, m));

  const base = {
    round,
    ...describeRound(engine, round),
    locked: clock.locked,
    nextRoundAt: clock.nextRoundAt,
    match: null,
    settled: thisRound.find((o) => o.result === "bye") ?? thisRound[0] ?? null,
  };

  const active = engine
    .getMatches()
    .find((m) => m.isActive() && (m.getPlayer1().id === registrationId || m.getPlayer2().id === registrationId));
  if (active) {
    return { ...base, state: "match", match: await getMyCurrentMatch(slug, registrationId) };
  }

  if (base.settled?.result === "bye") return { ...base, state: "bye" };
  if (!player.isActive()) return { ...base, state: "out" };
  return { ...base, state: "waiting" };
}

export type MyMatchHistoryEntry = {
  round: number;
  phase: RoundPhase;
  roundLabel: string;
  opponentName: string | null;
  result: "win" | "loss" | "draw" | "bye";
  score: string;
};

/** One settled match of this player's, as a row - the same shape whether it is read back as history or as "what you already did this round". */
function toOutcome(
  engine: EngineTournament,
  record: { id: string; opponent: string | null; win: number; loss: number },
): MyMatchHistoryEntry {
  const match = engine.getMatch(record.id);
  const opponent = record.opponent ? engine.getPlayers().find((p) => p.getId() === record.opponent) : undefined;
  return {
    round: match.getRoundNumber(),
    ...describeRound(engine, match.getRoundNumber()),
    opponentName: opponent?.getName() ?? null,
    result: match.isBye()
      ? "bye"
      : record.win > record.loss
        ? "win"
        : record.loss > record.win
          ? "loss"
          : "draw",
    score: `${record.win}-${record.loss}`,
  };
}

/**
 * Every round this player has *finished* in this tournament, oldest first -
 * the "your duels" list on the event page. Anything in the round currently
 * being played is left out on purpose, bye included: that belongs to the
 * current-round card (getMyRound), and listing it here as well makes a bye
 * read like a result from some other round.
 */
export async function getMyMatchHistory(slug: string, registrationId: string): Promise<MyMatchHistoryEntry[]> {
  const tournamentId = await repos().tournaments.findIdBySlug(slug);
  if (!tournamentId) return [];
  const engine = await loadEngine(tournamentId);
  if (!engine) return [];

  const player = engine.getPlayers().find((p) => p.getId() === registrationId);
  if (!player) return [];

  // Once the bracket is over there is no round in progress, so nothing is held back.
  const currentRound = engine.getStatus() === "complete" ? 0 : engine.getRoundNumber();

  return player
    .getMatches()
    .filter((m) => {
      const match = engine.getMatch(m.id);
      // Still open - that's the current-round card's job, not history.
      return !match.isActive() && match.getRoundNumber() !== currentRound;
    })
    .map((m) => toOutcome(engine, m))
    .sort((a, b) => a.round - b.round);
}

/** Test seam. */
export async function resetResultsData(): Promise<void> {
  const { brackets, placings, matchReports, matchDeadlines, matchFlags } = repos();
  await brackets.clear();
  await placings.clear();
  await matchReports.clear();
  await matchDeadlines.clear();
  await matchFlags.clear();
}

// --- No-shows, contests and disqualifications ---------------------------------

/** Sends one alert to every moderator. Thin wrapper so the notification shape stays in one place. */
async function notifyAdmins(input: { kind: string; title: string; body: string; fingerprint: string }): Promise<void> {
  const { notify } = await import("./notifications.service.ts");
  const { createHash } = await import("node:crypto");
  await notify({
    id: crypto.randomUUID(),
    audience: "admin",
    playerId: null,
    kind: input.kind,
    title: input.title,
    body: input.body,
    metadata: null,
    fingerprint: createHash("sha256").update(input.fingerprint).digest("hex"),
  });
}

/** Sends one alert to a single player. */
async function notifyPlayer(
  registrationId: string,
  input: { kind: string; title: string; body: string; fingerprint: string },
): Promise<void> {
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

export type NoShowOutcome = "raised" | "too-early" | "already-open" | "not-your-match" | "match-closed";

/**
 * "My opponent never turned up." Available a few minutes into a match, and it
 * does not decide anything by itself: it alerts the moderators and the accused
 * player, and marks the match on the bracket. In a same-day tournament an
 * unanswered call hands the match over after NO_SHOW_GRACE_MS; a long-duration
 * one waits for a moderator however long that takes. Either player in the duel
 * can call it off (dismissNoShow).
 */
export async function reportNoShow(slug: string, matchId: string, registrationId: string): Promise<NoShowOutcome> {
  const { tournaments, matchFlags, matchDeadlines } = repos();
  const [tournamentId, event] = await Promise.all([tournaments.findIdBySlug(slug), tournaments.findBySlug(slug)]);
  if (!tournamentId || !event) throw new Error(`Tournament "${slug}" does not exist`);
  const engine = await loadEngine(tournamentId);
  if (!engine) throw new Error(`Tournament "${slug}" has no bracket yet`);

  const match = engine.getMatch(matchId);
  if (!match.isActive()) return "match-closed";
  const p1Id = match.getPlayer1().id;
  const p2Id = match.getPlayer2().id;
  if (registrationId !== p1Id && registrationId !== p2Id) return "not-your-match";

  const tracking = (await matchDeadlines.getTrackingMap(tournamentId)).get(matchId);
  if (!tracking || Date.now() - tracking.activeSince.getTime() < NO_SHOW_AVAILABLE_AFTER_MS) return "too-early";
  if (await matchFlags.findOpen(matchId, "no_show")) return "already-open";

  const opponentId = registrationId === p1Id ? p2Id : p1Id;
  const sameDay = event.durationMode !== "long";

  await matchFlags.raise({
    tournamentId,
    matchId,
    kind: "no_show",
    reporterRegistrationId: registrationId,
    targetRegistrationId: opponentId,
    autoResolvesAt: sameDay ? new Date(Date.now() + NO_SHOW_GRACE_MS) : null,
  });

  const nameOf = (id: string | null) => engine.getPlayers().find((p) => p.getId() === id)?.getName() ?? "?";
  const label = eliminationMatches(engine).get(matchId)?.label ?? describeRound(engine, match.getRoundNumber()).roundLabel;

  await notifyAdmins({
    kind: "match.no_show",
    title: `No-show reported - ${nameOf(opponentId)} in ${event.name}`,
    body: [
      `Tournament: ${event.name} (${slug}), ${event.structure}, ${event.matchFormat}`,
      `Round: ${label}`,
      `Players: ${nameOf(p1Id)} vs ${nameOf(p2Id)}`,
      `Reported by: ${nameOf(registrationId)}`,
      `Accused of not showing: ${nameOf(opponentId)}`,
      sameDay
        ? `Decides itself in ${NO_SHOW_GRACE_MS / 60000} minutes unless someone dismisses it.`
        : "Waiting on a moderator - a long-duration tournament never decides this on its own.",
      `Manage: /admin/tournaments/${slug}/bracket`,
    ].join("\n"),
    fingerprint: `no_show|${matchId}|${Date.now()}`,
  });

  if (opponentId) {
    await notifyPlayer(opponentId, {
      kind: "match.no_show",
      title: `${nameOf(registrationId)} reported you as a no-show in ${event.name}`,
      body:
        `Your opponent in ${label} says you have not turned up for the duel. ` +
        (sameDay
          ? `If nothing happens in the next ${NO_SHOW_GRACE_MS / 60000} minutes, the match is awarded to them. `
          : "A moderator will look at it. ") +
        "Open the tournament and report your result, or dismiss the call if you are there. " +
        "Two no-shows that stand means disqualification.",
      fingerprint: `no_show_player|${matchId}|${Date.now()}`,
    });
  }

  return "raised";
}

/** Called off by either player in the duel, or by a moderator. The match simply carries on. */
export async function dismissNoShow(slug: string, matchId: string, by: string): Promise<boolean> {
  return repos().matchFlags.dismiss(matchId, "no_show", by);
}

/**
 * Hands over every same-day match whose no-show call ran out of grace. The
 * player who was called out loses, and that no-show goes on their record -
 * two of them and they are disqualified.
 */
export async function resolveDueNoShows(now: Date = new Date(), tournamentId?: string): Promise<number> {
  const { matchFlags, tournaments, registrations } = repos();
  const due = await matchFlags.listDueNoShows(now, tournamentId);
  let resolved = 0;

  for (const flag of due) {
    const slug = await tournaments.findSlugById(flag.tournamentId);
    if (!slug) continue;
    const engine = await loadEngine(flag.tournamentId);
    if (!engine) continue;

    const match = engine.getMatch(flag.matchId);
    if (!match?.isActive()) {
      await matchFlags.dismiss(flag.matchId, "no_show", "match already settled");
      continue;
    }

    enterFromReport(engine, flag.matchId, flag.reporterRegistrationId, true);
    await persistEngine(flag.tournamentId, engine);
    await matchFlags.resolve(flag.matchId, "no_show");
    await syncMatchDeadlines(flag.tournamentId, engine);
    resolved++;

    if (!flag.targetRegistrationId) continue;
    const strikes = await registrations.incrementNoShows(flag.targetRegistrationId);
    await notifyPlayer(flag.targetRegistrationId, {
      kind: "match.no_show",
      title: `You lost a match by no-show`,
      body:
        `Nobody answered the no-show call on your duel, so it was awarded to your opponent. ` +
        `That is no-show ${strikes} of ${NO_SHOW_DQ_LIMIT} - reaching ${NO_SHOW_DQ_LIMIT} means disqualification.`,
      fingerprint: `no_show_lost|${flag.matchId}`,
    });

    if (strikes >= NO_SHOW_DQ_LIMIT) {
      await disqualifyRegistration(slug, flag.targetRegistrationId, `${strikes} no-shows`, "system");
    }
  }

  return resolved;
}

/**
 * Puts a player out of a tournament for good: recorded on the registration,
 * removed from the bracket, and they are told why. Used by the two-no-show
 * rule, by the deck lock, and by a moderator doing it by hand.
 */
export async function disqualifyRegistration(
  slug: string,
  registrationId: string,
  reason: string,
  by: string,
): Promise<void> {
  await repos().registrations.markDisqualified(registrationId, reason);
  await dropFromStartedTournament(slug, registrationId).catch(() => {});
  await notifyPlayer(registrationId, {
    kind: "player.disqualified",
    title: `You have been disqualified`,
    body:
      `You are out of this tournament. Reason on file: ${reason}. ` +
      (by === "system" ? "This was applied automatically. " : `Applied by ${by}. `) +
      "Contact a Tournament Organizer if you believe this is a mistake.",
    fingerprint: `dq|${registrationId}`,
  });
}

/**
 * Undoes a disqualification: the flags come off and the player is active in
 * the bracket again. Matches already conceded while they were out stay as
 * they are - a moderator can correct those individually.
 */
export async function reinstateRegistration(slug: string, registrationId: string): Promise<void> {
  const tournamentId = await repos().tournaments.findIdBySlug(slug);
  if (!tournamentId) throw new Error(`Tournament "${slug}" does not exist`);

  await repos().registrations.clearDisqualification(registrationId);

  const engine = await loadEngine(tournamentId);
  const player = engine?.getPlayers().find((p) => p.getId() === registrationId);
  if (engine && player) {
    player.set({ active: true });
    await persistEngine(tournamentId, engine);
  }

  await notifyPlayer(registrationId, {
    kind: "player.disqualified",
    title: "Your disqualification was lifted",
    body: "A Tournament Organizer reinstated you - you are back in the tournament.",
    fingerprint: `dq_undo|${registrationId}|${Date.now()}`,
  });
}
