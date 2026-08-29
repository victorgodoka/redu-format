import { teardownTestDb } from "./backend/db/test-setup.ts";

import assert from "node:assert/strict";
import test from "node:test";
import { getPool } from "./backend/db/client.ts";
import { toMysqlDatetimeMs } from "./backend/db/datetime.ts";
import {
  closeOverdueMatches,
  contestMatchResult,
  disqualifyRegistration,
  dismissNoShow,
  reinstateRegistration,
  reportNoShow,
  resolveDueNoShows,
  completeBracket,
  dropFromStartedTournament,
  enterMatchResult,
  extendCurrentRoundDeadline,
  generateNextRound,
  getBracketView,
  getLeaderboard,
  getPlacings,
  hasBracket,
  RepairConfirmationRequired,
  startBracket,
  submitMatchReport,
  type BracketView,
} from "./backend/services/results.service.ts";
import { resolvePlayerId } from "./backend/services/player.service.ts";
import { registerSignup } from "./backend/services/registration.service.ts";
import { addParticipant, createTournament, getTournament, listParticipants } from "./tournaments.ts";

test.after(teardownTestDb);

const swissDraft = {
  name: "Results Test Swiss",
  startsAt: "2027-01-01T18:00:00Z",
  structure: "swiss" as const,
  rounds: 2,
  topCut: 2,
  matchFormat: "Bo1" as const,
  roundLimitDays: 2,
  durationMode: "same_day" as const,
  roundMinutes: 50,
  cleanupMinutes: 10,
  engine: "dueling-nexus",
  seats: 32,
  entry: { type: "free" as const },
  host: "Test Host",
  signupUrl: "#",
};

async function seatFourViaAdmin(slug: string) {
  await addParticipant(slug, { name: "Alice", deckName: "Wind-Up" });
  await addParticipant(slug, { name: "Bob", deckName: "Geargia" });
  await addParticipant(slug, { name: "Cara", deckName: "Agent" });
  await addParticipant(slug, { name: "Dan", deckName: "Chaos Dragon" });
}

/**
 * Enters 1-0 results for every open match, round after round, until nothing is
 * left to play. Swiss rounds need an explicit generateNextRound() call between
 * them (which also transitions into top cut once stage one's rounds run out);
 * elimination-stage matches instead advance on their own the moment a result
 * comes in, via the library's own bracket-path following - generateNextRound()
 * is invalid there and throws, which is exactly the terminal condition here.
 */
async function playOutTournament(slug: string): Promise<BracketView> {
  for (let i = 0; i < 20; i++) {
    const view = (await getBracketView(slug))!;
    const openMatches = view.matches.filter((m) => m.active && !m.hasResult && !m.bye);

    if (openMatches.length > 0) {
      for (const match of openMatches) {
        await enterMatchResult(slug, match.id, 1, 0);
      }
      continue;
    }

    try {
      await generateNextRound(slug);
    } catch {
      return (await getBracketView(slug))!;
    }
  }
  throw new Error("playOutTournament did not terminate within 20 iterations");
}

test("starting a bracket requires enough registered participants", async () => {
  const tournament = await createTournament(swissDraft);
  await addParticipant(tournament.slug, { name: "Solo", deckName: "Wind-Up" });

  const event = (await getTournament(tournament.slug))!;
  await assert.rejects(() => startBracket(tournament.slug, event));
});

test("startBracket records startedAt, even when the tournament's advertised startsAt is still in the future", async () => {
  const tournament = await createTournament({
    ...swissDraft,
    startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });
  await seatFourViaAdmin(tournament.slug);

  const before = (await getTournament(tournament.slug))!;
  assert.equal(before.startedAt, null);

  await startBracket(tournament.slug, before);

  const started = (await getTournament(tournament.slug))!;
  assert.notEqual(started.startedAt, null);
  assert.ok(new Date(started.startedAt!) < new Date(started.startsAt), "started before the advertised time");
  assert.equal(started.finishedAt, null, "in progress, not finished yet");

  await playOutTournament(tournament.slug);
  await completeBracket(tournament.slug);

  const finished = (await getTournament(tournament.slug))!;
  assert.notEqual(finished.finishedAt, null);
});

test("full swiss + top cut lifecycle: start, play every round, complete, leaderboard", async () => {
  const tournament = await createTournament(swissDraft);
  await seatFourViaAdmin(tournament.slug);

  assert.equal(await hasBracket(tournament.slug), false);

  const event = (await getTournament(tournament.slug))!;
  await startBracket(tournament.slug, event);
  assert.equal(await hasBracket(tournament.slug), true);

  const started = await getBracketView(tournament.slug);
  assert.equal(started?.status, "stage-one");
  assert.equal(started?.round, 1);
  assert.equal(started?.matches.length, 2);

  const finalView = await playOutTournament(tournament.slug);
  assert.equal(finalView.status, "stage-two");
  assert.equal(
    finalView.matches.every((m) => m.hasResult || m.bye),
    true,
  );

  await completeBracket(tournament.slug);

  const placings = await getPlacings(tournament.slug);
  assert.equal(placings.length, 4);
  assert.deepEqual(
    placings.map((p) => p.place),
    [1, 2, 3, 4],
  );
  // Winner of the top cut final should out-point everyone else (regular match points plus the bonus).
  assert.ok(placings[0].points > placings[3].points);

  // Leaderboard only ever includes players linked to a real account - none of these four are.
  const leaderboard = await getLeaderboard();
  assert.deepEqual(leaderboard.rows, []);
  assert.equal(leaderboard.total, 0);
});

test("swiss with an odd number of players auto-assigns a bye each round, worth an automatic win", async () => {
  const tournament = await createTournament({ ...swissDraft, topCut: null });
  await seatFourViaAdmin(tournament.slug);
  await addParticipant(tournament.slug, { name: "Eve", deckName: "Burning Abyss" });

  const event = (await getTournament(tournament.slug))!;
  await startBracket(tournament.slug, event);

  const round1 = (await getBracketView(tournament.slug))!;
  assert.equal(round1.matches.length, 3, "5 players -> 2 real matches + 1 bye");
  const byeMatch = round1.matches.find((m) => m.bye);
  assert.ok(byeMatch, "an odd field must produce exactly one bye match");
  assert.equal(byeMatch!.player2, null);
  assert.equal(byeMatch!.active, false);
  // The library's hasEnded() requires both slots to carry a result, which a bye's empty
  // player2 never will - so hasResult is always false for byes. Every caller (playout
  // loop, admin UI) already checks `bye` before `hasResult` for exactly this reason.
  assert.equal(byeMatch!.hasResult, false);

  const byeStanding = round1.standings.find((s) => s.registrationId === byeMatch!.player1!.registrationId);
  assert.equal(byeStanding?.points, 3, "a bye pays the same as a match win, with nothing to report");

  const finalView = await playOutTournament(tournament.slug);
  await completeBracket(tournament.slug);

  const placings = await getPlacings(tournament.slug);
  assert.equal(placings.length, 5);
  assert.equal(
    finalView.matches.every((m) => m.hasResult || m.bye),
    true,
  );
});

test("self-report: one report settles the duel with its score, and the other player can contest it", async () => {
  const tournament = await createTournament({ ...swissDraft, name: "Self Report Cup", topCut: null });
  await seatFourViaAdmin(tournament.slug);

  const event = (await getTournament(tournament.slug))!;
  await startBracket(tournament.slug, event);

  const [match] = (await getBracketView(tournament.slug))!.matches;
  const winnerId = match.player1!.registrationId;
  const loserId = match.player2!.registrationId;

  // Bo1 here, so the only possible score is 1-0 - a Bo3 would report 2-0 or 2-1.
  await submitMatchReport(tournament.slug, match.id, winnerId, true, 1, 0);

  const settled = (await getBracketView(tournament.slug))!.matches.find((m) => m.id === match.id)!;
  assert.equal(settled.hasResult, true, "one report is enough - nobody has to confirm it");
  assert.equal(settled.score, "1-0");
  assert.equal(settled.player1!.win, 1);
  assert.equal(settled.player2!.loss, 1);
  assert.equal(settled.reports.length, 1, "who called it stays on file, for the opponent to see");

  // The player who did not report disagrees: nothing moves in the bracket, but
  // the match is flagged for a moderator.
  await contestMatchResult(tournament.slug, match.id, loserId);
  const contested = (await getBracketView(tournament.slug))!.matches.find((m) => m.id === match.id)!;
  assert.equal(contested.contested, true);
  assert.equal(contested.hasResult, true, "contesting does not undo the result - only a moderator does");
});

test("a Bo3 series records the games that were actually played", async () => {
  const tournament = await createTournament({
    ...swissDraft,
    name: "Bo3 Score Cup",
    topCut: null,
    matchFormat: "Bo3",
  });
  await seatFourViaAdmin(tournament.slug);
  const event = (await getTournament(tournament.slug))!;
  await startBracket(tournament.slug, event);

  const [match] = (await getBracketView(tournament.slug))!.matches;
  await submitMatchReport(tournament.slug, match.id, match.player1!.registrationId, true, 2, 1);

  const settled = (await getBracketView(tournament.slug))!.matches.find((m) => m.id === match.id)!;
  assert.equal(settled.score, "2-1");

  // A score that cannot happen in a Bo3 is refused outright.
  const [, other] = (await getBracketView(tournament.slug))!.matches;
  await assert.rejects(
    () => submitMatchReport(tournament.slug, other.id, other.player1!.registrationId, true, 2, 2),
    /Bo3 series is won/,
  );
});

test("closeOverdueMatches force-closes the matches nobody reported - a reported one is already long settled", async () => {
  const tournament = await createTournament({ ...swissDraft, topCut: null, roundLimitDays: 2 });
  await seatFourViaAdmin(tournament.slug);

  const event = (await getTournament(tournament.slug))!;
  await startBracket(tournament.slug, event);

  const [reportedMatch, silentMatch] = (await getBracketView(tournament.slug))!.matches;
  await submitMatchReport(tournament.slug, reportedMatch.id, reportedMatch.player2!.registrationId, false, 1, 0);
  assert.equal(
    (await getBracketView(tournament.slug))!.matches.find((m) => m.id === reportedMatch.id)!.hasResult,
    true,
    "one report settles a match immediately - the deadline has nothing left to do with it",
  );

  // Not overdue yet - the deadline job should leave everything untouched.
  assert.deepEqual(await closeOverdueMatches(tournament.slug), { resolved: 0, advanced: false });

  // Push both matches' clocks back past the 2-day round limit.
  const pool = getPool();
  const backdated = toMysqlDatetimeMs(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString());
  await pool.query("UPDATE match_deadlines SET active_since = ? WHERE match_id IN (?, ?)", [
    backdated,
    reportedMatch.id,
    silentMatch.id,
  ]);

  const { resolved } = await closeOverdueMatches(tournament.slug);
  assert.equal(resolved, 1, "only the silent match was still open");

  const after = (await getBracketView(tournament.slug))!;
  const resolvedReported = after.matches.find((m) => m.id === reportedMatch.id)!;
  // player2 said they lost, so player2 lost - that has been true since they said it.
  assert.equal(resolvedReported.player2!.loss, 1);

  const resolvedSilent = after.matches.find((m) => m.id === silentMatch.id)!;
  assert.equal(resolvedSilent.hasResult, true, "a fully silent match still gets force-resolved, not left stuck");
  // Swiss has no elimination constraint, so a fully silent match is a genuine
  // double loss: 0-0, not an arbitrary winner and not a draw (which would
  // otherwise silently score a point for both sides).
  assert.equal(resolvedSilent.player1!.win, 0);
  assert.equal(resolvedSilent.player2!.win, 0);
  const silentP1Standing = after.standings.find((s) => s.registrationId === resolvedSilent.player1!.registrationId)!;
  assert.equal(silentP1Standing.points, 0, "double loss awards no points");

  // Both round-1 matches settled, so the swiss round itself should have advanced.
  assert.equal(after.round, 2);
});

test("closeOverdueMatches: a fully silent elimination match still needs a winner to advance the bracket", async () => {
  const tournament = await createTournament({ ...swissDraft, structure: "single-elim", topCut: null });
  await seatFourViaAdmin(tournament.slug);

  const event = (await getTournament(tournament.slug))!;
  await startBracket(tournament.slug, event);

  const [matchA] = (await getBracketView(tournament.slug))!.matches;

  const pool = getPool();
  const backdated = toMysqlDatetimeMs(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString());
  await pool.query("UPDATE match_deadlines SET active_since = ? WHERE match_id = ?", [backdated, matchA.id]);

  await closeOverdueMatches(tournament.slug);

  const resolved = (await getBracketView(tournament.slug))!.matches.find((m) => m.id === matchA.id)!;
  assert.equal(resolved.hasResult, true);
  // A 0-0 double loss can't advance anyone in an elimination bracket, so this
  // format falls back to an arbitrary winner (player1) instead.
  assert.equal(resolved.player1!.win, 1);
  assert.equal(resolved.player2!.win, 0);
});

test("extendCurrentRoundDeadline pushes out the deadline of active matches, so an overdue sweep no longer force-resolves them", async () => {
  const tournament = await createTournament({ ...swissDraft, topCut: null, roundLimitDays: 2 });
  await seatFourViaAdmin(tournament.slug);

  const event = (await getTournament(tournament.slug))!;
  await startBracket(tournament.slug, event);

  const [matchA] = (await getBracketView(tournament.slug))!.matches;
  const before = matchA.deadlineAt!;

  // Push it just past its normal 2-day deadline.
  const pool = getPool();
  const backdated = toMysqlDatetimeMs(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString());
  await pool.query("UPDATE match_deadlines SET active_since = ? WHERE match_id = ?", [backdated, matchA.id]);

  const { extended } = await extendCurrentRoundDeadline(tournament.slug, 96);
  assert.ok(extended >= 1);

  const after = (await getBracketView(tournament.slug))!.matches.find((m) => m.id === matchA.id)!;
  assert.ok(new Date(after.deadlineAt!) > new Date(before), "the extension pushed the deadline forward");

  // Overdue by the original computation, but the extension should have cleared that.
  const { resolved } = await closeOverdueMatches(tournament.slug);
  assert.equal(resolved, 0, "the extended match isn't overdue anymore");
});

test("dropFromStartedTournament: current round becomes a loss for them and an automatic win for their opponent, future rounds skip them", async () => {
  const tournament = await createTournament({ ...swissDraft, topCut: null });
  await seatFourViaAdmin(tournament.slug);
  const event = (await getTournament(tournament.slug))!;
  await startBracket(tournament.slug, event);

  const [matchA, matchB] = (await getBracketView(tournament.slug))!.matches;
  const droppedId = matchA.player1!.registrationId;
  const opponentId = matchA.player2!.registrationId;

  await dropFromStartedTournament(tournament.slug, droppedId);
  await enterMatchResult(tournament.slug, matchB.id, 1, 0);

  // Swiss's assignLoss() (what a mid-round drop uses under the hood) doesn't edit the
  // original shared match - it retires it and gives each side their own single-player
  // record instead: a loss for the dropped player, a bye-win for their opponent.
  const afterDrop = (await getBracketView(tournament.slug))!;
  const droppedRow = afterDrop.matches.find((m) => m.round === 1 && m.player1?.registrationId === droppedId);
  assert.equal(droppedRow?.hasResult, true, "dropping mid-match settles it instead of leaving it stuck open");
  const opponentBye = afterDrop.matches.find(
    (m) => m.round === 1 && m.bye && m.player1?.registrationId === opponentId,
  );
  assert.ok(opponentBye, "the opponent gets an automatic win for the round");
  assert.equal(afterDrop.standings.find((s) => s.registrationId === droppedId)?.dropped, true);

  await generateNextRound(tournament.slug);
  const round2 = (await getBracketView(tournament.slug))!;
  const stillPaired = round2.matches.some(
    (m) =>
      m.round === 2 &&
      (m.player1?.registrationId === droppedId || m.player2?.registrationId === droppedId),
  );
  assert.equal(stillPaired, false, "a dropped player is never paired again");
});

test("closeOverdueMatches auto-drops a player after two rounds where their match went entirely unreported", async () => {
  const tournament = await createTournament({ ...swissDraft, topCut: null, roundLimitDays: 2 });
  await seatFourViaAdmin(tournament.slug);
  const event = (await getTournament(tournament.slug))!;
  await startBracket(tournament.slug, event);

  const firstRound = (await getBracketView(tournament.slug))!;
  const silentPlayerId = firstRound.matches[0].player1!.registrationId;

  /**
   * One report settles a duel now, so a player only counts as absent when
   * *nobody* reported their match. Every other table is settled by an admin;
   * the silent player's is left hanging past the deadline.
   */
  async function silentRound() {
    const view = (await getBracketView(tournament.slug))!;
    const mine = view.matches.find(
      (m) =>
        m.active &&
        !m.bye &&
        (m.player1?.registrationId === silentPlayerId || m.player2?.registrationId === silentPlayerId),
    )!;

    for (const m of view.matches.filter((match) => match.active && !match.bye && match.id !== mine.id)) {
      await enterMatchResult(tournament.slug, m.id, 1, 0);
    }

    const pool = getPool();
    const backdated = toMysqlDatetimeMs(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString());
    await pool.query(
      `UPDATE match_deadlines SET active_since = ?
       WHERE tournament_id = (SELECT id FROM tournaments WHERE slug = ?)`,
      [backdated, tournament.slug],
    );
    await closeOverdueMatches(tournament.slug);
  }

  await silentRound();
  const afterRound1 = (await getBracketView(tournament.slug))!;
  assert.equal(afterRound1.round, 2, "a fully-settled round 1 advances on its own");
  assert.equal(
    afterRound1.standings.find((s) => s.registrationId === silentPlayerId)?.dropped,
    false,
    "one missed round alone isn't enough to drop",
  );

  await silentRound();
  const afterRound2 = (await getBracketView(tournament.slug))!;
  assert.equal(afterRound2.standings.find((s) => s.registrationId === silentPlayerId)?.dropped, true);
});

test("official tiebreaker: identical points and opponents - the later loss (higher DDD) ranks ahead", async () => {
  const tournament = await createTournament({ ...swissDraft, topCut: null });
  await seatFourViaAdmin(tournament.slug);

  const event = (await getTournament(tournament.slug))!;
  await startBracket(tournament.slug, event);

  // Round 1 pairing isn't something this test controls (sorting: "none", no ratings to
  // seed by) - only the shape matters: whoever's in player1's seat wins each match.
  const [matchX, matchY] = (await getBracketView(tournament.slug))!.matches;
  const winnerX = matchX.player1!.registrationId;
  const loserX = matchX.player2!.registrationId;
  const winnerY = matchY.player1!.registrationId;
  const loserY = matchY.player2!.registrationId;
  await enterMatchResult(tournament.slug, matchX.id, 1, 0);
  await enterMatchResult(tournament.slug, matchY.id, 1, 0);

  await generateNextRound(tournament.slug);
  const round2 = (await getBracketView(tournament.slug))!.matches.filter((m) => m.round === 2);
  const seatedBy = (ids: [string, string]) =>
    round2.find((m) => {
      const seats = [m.player1?.registrationId, m.player2?.registrationId];
      return ids.every((id) => seats.includes(id));
    })!;
  const winnersMatch = seatedBy([winnerX, winnerY]);
  const losersMatch = seatedBy([loserX, loserY]);
  assert.ok(winnersMatch, "the two round-1 winners should be paired together in round 2");
  assert.ok(losersMatch, "the two round-1 losers should be paired together in round 2");

  // Whoever's in player1's seat wins the winners' match - the other one (lateLoser)
  // loses in round 2 instead of round 1.
  const roundTwoVictor = winnersMatch.player1!.registrationId;
  const lateLoser = winnersMatch.player2!.registrationId;
  await enterMatchResult(tournament.slug, winnersMatch.id, 1, 0);

  // For earlyLoser's opponent set to match lateLoser's exactly ({their round-1 opponent,
  // roundTwoVictor}), earlyLoser must specifically be roundTwoVictor's round-1 victim -
  // and must win the losers' match this round, so both end at 3 points (1 win, 1 loss).
  const earlyLoser = roundTwoVictor === winnerX ? loserX : loserY;
  const earlyLoserIsP1 = losersMatch.player1!.registrationId === earlyLoser;
  await enterMatchResult(tournament.slug, losersMatch.id, earlyLoserIsP1 ? 1 : 0, earlyLoserIsP1 ? 0 : 1);

  await completeBracket(tournament.slug);
  const placings = await getPlacings(tournament.slug);
  const lateLoserPlacing = placings.find((p) => p.registrationId === lateLoser)!;
  const earlyLoserPlacing = placings.find((p) => p.registrationId === earlyLoser)!;

  assert.equal(lateLoserPlacing.points, earlyLoserPlacing.points, "both end at 3 match points (1 win, 1 loss)");
  assert.ok(
    lateLoserPlacing.place < earlyLoserPlacing.place,
    "losing round 2 (DDD 2^2=4) ranks ahead of losing round 1 (DDD 1^2=1), given identical points/opponents",
  );
});

test("enterMatchResult refuses to correct a match once the next round has started", async () => {
  const tournament = await createTournament({ ...swissDraft, topCut: null });
  await seatFourViaAdmin(tournament.slug);

  const event = (await getTournament(tournament.slug))!;
  await startBracket(tournament.slug, event);

  const round1 = (await getBracketView(tournament.slug))!.matches.filter((m) => m.round === 1);
  for (const match of round1) {
    await enterMatchResult(tournament.slug, match.id, 1, 0);
  }
  await generateNextRound(tournament.slug);

  // Round 1 is closed now that round 2 has been paired - no more corrections.
  await assert.rejects(() => enterMatchResult(tournament.slug, round1[0].id, 0, 1));

  // The round in progress is still correctable.
  const round2 = (await getBracketView(tournament.slug))!.matches.filter((m) => m.round === 2);
  await assert.doesNotReject(() => enterMatchResult(tournament.slug, round2[0].id, 1, 0));
});

test("enterMatchResult: pairing a later round early doesn't block fresh entries for the current round's other matches", async () => {
  const tournament = await createTournament({ ...swissDraft, structure: "single-elim", topCut: null });
  // 8 players so round 1 has 4 independent matches - enough to pair off a
  // semifinal (round 2) after only 2 of the 4 quarterfinals are entered.
  for (let i = 1; i <= 8; i++) {
    await addParticipant(tournament.slug, { name: `P${i}`, deckName: "Wind-Up" });
  }

  const event = (await getTournament(tournament.slug))!;
  await startBracket(tournament.slug, event);

  const round1 = (await getBracketView(tournament.slug))!.matches.filter((m) => m.round === 1);
  assert.equal(round1.length, 4);

  // These two pair off a round-2 semifinal as a side effect.
  await enterMatchResult(tournament.slug, round1[0].id, 1, 0);
  await enterMatchResult(tournament.slug, round1[1].id, 1, 0);

  // The other two quarterfinals are still fresh, first-time entries for their
  // own round - the round-2 pairing side effect above must not block them.
  await assert.doesNotReject(() => enterMatchResult(tournament.slug, round1[2].id, 1, 0));
  await assert.doesNotReject(() => enterMatchResult(tournament.slug, round1[3].id, 1, 0));
});

test("completeBracket assigns ranking points by finishing place, separate from match points", async () => {
  const tournament = await createTournament({ ...swissDraft, structure: "single-elim", topCut: null });
  await seatFourViaAdmin(tournament.slug);
  const event = (await getTournament(tournament.slug))!;
  await startBracket(tournament.slug, event);
  await playOutTournament(tournament.slug);
  await completeBracket(tournament.slug);

  const placings = await getPlacings(tournament.slug);
  const first = placings.find((p) => p.place === 1)!;
  const second = placings.find((p) => p.place === 2)!;
  assert.equal(first.rankingPoints, 100, "1st place awards the leaderboard formula's top value");
  assert.equal(second.rankingPoints, 75);
  assert.notEqual(first.rankingPoints, first.points, "ranking points and match points are tracked separately");
});

test("leaderboard aggregates points across tournaments, only for real players", async () => {
  const a = await createTournament({ ...swissDraft, name: "LB Cup A", topCut: null });
  const b = await createTournament({ ...swissDraft, name: "LB Cup B", topCut: null });

  const playerId = await resolvePlayerId("token-lb", {
    name: "LeaderboardPlayer",
    avatar: "",
    contributor: false,
    contributorTime: 0,
  });

  for (const tournament of [a, b]) {
    await registerSignup(tournament.slug, {
      playerId,
      nexusIdentityKey: "test-identity-key",
      displayName: "LeaderboardPlayer",
      deckId: "deck-1",
      deckName: "Wind-Up",
      entry: tournament.entry,
    });
    await addParticipant(tournament.slug, { name: "Rival", deckName: "Geargia" });
    await addParticipant(tournament.slug, { name: "Filler1", deckName: "Agent" });
    await addParticipant(tournament.slug, { name: "Filler2", deckName: "Chaos Dragon" });

    const event = (await getTournament(tournament.slug))!;
    await startBracket(tournament.slug, event);
    await playOutTournament(tournament.slug);
    await completeBracket(tournament.slug);
  }

  const leaderboard = await getLeaderboard();
  const entry = leaderboard.rows.find((row) => row.playerId === playerId);
  assert.ok(entry, "leaderboard should include the linked player");
  assert.equal(entry!.eventsPlayed, 2);
  assert.ok(entry!.totalPoints > 0);
});

test("standard same-day: the round locks on its 50-minute timer, refuses late reports, and pairs the next round after the cleanup window", async () => {
  const tournament = await createTournament({
    ...swissDraft,
    name: "Same Day Cup",
    topCut: null,
    durationMode: "same_day",
    roundMinutes: 50,
    cleanupMinutes: 10,
  });
  await seatFourViaAdmin(tournament.slug);
  const event = (await getTournament(tournament.slug))!;
  await startBracket(tournament.slug, event);

  const pool = getPool();
  const backdateBy = async (minutes: number) => {
    await pool.query(
      `UPDATE match_deadlines SET active_since = ?
       WHERE tournament_id = (SELECT id FROM tournaments WHERE slug = ?)`,
      [toMysqlDatetimeMs(new Date(Date.now() - minutes * 60 * 1000).toISOString()), tournament.slug],
    );
  };

  const open = (await getBracketView(tournament.slug))!;
  assert.equal(open.clock.locked, false, "a fresh round is open");
  assert.equal(open.clock.durationMode, "same_day");

  // 55 minutes in: the timer ran out, so the round is locked - but the cleanup
  // window hasn't, so the next round is not paired yet.
  await backdateBy(55);
  const locked = (await getBracketView(tournament.slug))!;
  assert.equal(locked.clock.locked, true, "the 50-minute timer expired");
  assert.equal(locked.round, 1);

  const [match] = locked.matches;
  await assert.rejects(
    () => submitMatchReport(tournament.slug, match.id, match.player1!.registrationId, true, 1, 0),
    /locked/i,
    "the backend refuses a report in a locked round, not just the UI",
  );

  const held = await closeOverdueMatches(tournament.slug);
  assert.equal(held.advanced, false, "the cleanup window is still running");
  assert.equal((await getBracketView(tournament.slug))!.round, 1);

  // Past the cleanup window: unresolved matches are force-closed and the next
  // round pairs itself, with no moderator and no open browser involved.
  await backdateBy(65);
  const swept = await closeOverdueMatches(tournament.slug);
  assert.equal(swept.advanced, true);
  assert.equal((await getBracketView(tournament.slug))!.round, 2);
});

test("long duration: the round locks when the deadline passes but only a moderator ever starts the next one", async () => {
  const tournament = await createTournament({
    ...swissDraft,
    name: "Long Haul Cup",
    topCut: null,
    durationMode: "long",
    roundLimitDays: 2,
  });
  await seatFourViaAdmin(tournament.slug);
  const event = (await getTournament(tournament.slug))!;
  await startBracket(tournament.slug, event);

  // An hour in, a long-duration round is nowhere near its deadline.
  const pool = getPool();
  await pool.query(
    `UPDATE match_deadlines SET active_since = ?
     WHERE tournament_id = (SELECT id FROM tournaments WHERE slug = ?)`,
    [toMysqlDatetimeMs(new Date(Date.now() - 60 * 60 * 1000).toISOString()), tournament.slug],
  );
  assert.equal((await getBracketView(tournament.slug))!.clock.locked, false);

  await pool.query(
    `UPDATE match_deadlines SET active_since = ?
     WHERE tournament_id = (SELECT id FROM tournaments WHERE slug = ?)`,
    [toMysqlDatetimeMs(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()), tournament.slug],
  );

  const swept = await closeOverdueMatches(tournament.slug);
  assert.equal(swept.resolved > 0, true, "the deadline still force-closes the round's matches");
  assert.equal(swept.advanced, false, "a long-duration tournament never pairs a round by itself");

  const waiting = (await getBracketView(tournament.slug))!;
  assert.equal(waiting.round, 1, "it waits in the locked round");
  assert.equal(waiting.clock.locked, true);
  assert.equal(waiting.clock.awaitingModerator, true);
  assert.equal(waiting.clock.nextRoundAt, null);

  await generateNextRound(tournament.slug);
  assert.equal((await getBracketView(tournament.slug))!.round, 2, "a moderator moves it forward");
});

test("dropping someone who never made it into the bracket still marks the registration - the button can't be a silent no-op", async () => {
  const tournament = await createTournament({ ...swissDraft, name: "Late Signup Cup", topCut: null });
  await seatFourViaAdmin(tournament.slug);
  const event = (await getTournament(tournament.slug))!;
  await startBracket(tournament.slug, event);

  // Registered after the field was locked in, so the engine has never heard of
  // them - exactly the case where the admin's Drop button used to do nothing.
  const latecomer = await addParticipant(tournament.slug, { name: "Latecomer", deckName: "Wind-Up" });
  await dropFromStartedTournament(tournament.slug, latecomer.id);

  const row = (await listParticipants(tournament.slug)).find((p) => p.id === latecomer.id)!;
  assert.ok(row.droppedAt, "the registration is recorded as dropped");

  // And dropping an already-dropped player stays harmless.
  await dropFromStartedTournament(tournament.slug, latecomer.id);
  assert.ok((await listParticipants(tournament.slug)).find((p) => p.id === latecomer.id)!.droppedAt);
});

test("double elimination: the bracket keeps taking reports after round one - its rounds are a graph, not a lockstep clock", async () => {
  const tournament = await createTournament({
    ...swissDraft,
    name: "Double Elim Cup",
    structure: "double-elim",
    rounds: 0,
    topCut: null,
  });
  await seatFourViaAdmin(tournament.slug);
  const event = (await getTournament(tournament.slug))!;
  await startBracket(tournament.slug, event);

  // Settle the whole winners round one, which is the only round the engine's
  // own round counter ever moves to in an elimination bracket.
  for (const m of (await getBracketView(tournament.slug))!.matches.filter((m) => m.active && !m.bye)) {
    await enterMatchResult(tournament.slug, m.id, 1, 0);
  }

  const after = (await getBracketView(tournament.slug))!;
  assert.equal(
    after.clock.locked,
    false,
    "an elimination bracket with matches still to play is never a locked round",
  );

  const open = after.matches.filter((m) => m.active && !m.bye && m.player1 && m.player2);
  assert.ok(open.length > 0, "the losers bracket and winners final opened up");

  // The players who dropped into the losers bracket have to be able to report.
  const match = open[0];
  await submitMatchReport(tournament.slug, match.id, match.player1!.registrationId, true, 1, 0);
  const settled = (await getBracketView(tournament.slug))!.matches.find((m) => m.id === match.id)!;
  assert.equal(settled.hasResult, true, "both sides agreed, so the match resolved");
});

test("double elimination names every match by bracket side, and the grand final reset when it happens", async () => {
  const tournament = await createTournament({
    ...swissDraft,
    name: "Bracket Labels Cup",
    structure: "double-elim",
    rounds: 0,
    topCut: null,
  });
  await seatFourViaAdmin(tournament.slug);
  const event = (await getTournament(tournament.slug))!;
  await startBracket(tournament.slug, event);

  const built = (await getBracketView(tournament.slug))!;
  assert.deepEqual(
    [...new Set(built.matches.map((m) => m.bracket))].sort(),
    ["grand-final", "losers", "winners"],
    "the whole graph is classified by bracket side, not left as bare round numbers",
  );
  assert.equal(
    built.matches.some((m) => /^Round \d+$/.test(m.label)),
    false,
    'a double-elim match never reads as "Round 5" - that number is a bracket half, not a chronological round',
  );
  assert.ok(built.matches.some((m) => m.label === "Winners Final"));
  assert.ok(built.matches.some((m) => m.label === "Grand Final"));
  assert.equal(
    built.matches.some((m) => m.label === "Grand Final Reset"),
    false,
    "the reset only exists once it is actually forced",
  );

  // Play the bracket out with the losers-bracket finalist taking the grand
  // final, which is what forces the reset match into existence.
  for (let guard = 0; guard < 12; guard++) {
    const open = (await getBracketView(tournament.slug))!.matches.filter(
      (m) => m.active && !m.bye && m.player1 && m.player2,
    );
    if (open.length === 0) break;
    for (const m of open) {
      const grandFinal = m.bracket === "grand-final";
      await enterMatchResult(tournament.slug, m.id, grandFinal ? 0 : 1, grandFinal ? 1 : 0);
    }
  }

  const reset = (await getBracketView(tournament.slug))!.matches.find((m) => m.label === "Grand Final Reset");
  assert.ok(reset, "losing the grand final gave the undefeated finalist their first loss, so a reset match exists");
  assert.equal(reset.bracket, "grand-final");
});

test("enterMatchResult: a same-winner score correction is always allowed, even once downstream matches are decided", async () => {
  const tournament = await createTournament({
    ...swissDraft,
    name: "Repair Cup - Same Winner",
    structure: "double-elim",
    rounds: 0,
    topCut: null,
    matchFormat: "Bo3",
  });
  await seatFourViaAdmin(tournament.slug);
  const event = (await getTournament(tournament.slug))!;
  await startBracket(tournament.slug, event);

  const [m1] = (await getBracketView(tournament.slug))!.matches.filter((m) => m.bracket === "winners");
  await enterMatchResult(tournament.slug, m1.id, 2, 0);

  // Play out everything else that opened up as a result, so m1 now has
  // decided descendants - a correction that flips the winner would be
  // refused past this point, but the score alone is fair game.
  for (let guard = 0; guard < 8; guard++) {
    const open = (await getBracketView(tournament.slug))!.matches.filter(
      (m) => m.active && !m.bye && m.player1 && m.player2 && m.id !== m1.id,
    );
    if (open.length === 0) break;
    for (const m of open) await enterMatchResult(tournament.slug, m.id, 2, 0);
  }
  const beforeRepair = (await getBracketView(tournament.slug))!;
  const decidedDownstreamCount = beforeRepair.matches.filter((m) => m.id !== m1.id && m.hasResult).length;
  assert.ok(decidedDownstreamCount > 0, "test setup: something downstream of m1 must already be decided");

  await assert.doesNotReject(() => enterMatchResult(tournament.slug, m1.id, 2, 1));

  const after = (await getBracketView(tournament.slug))!;
  assert.equal(after.matches.find((m) => m.id === m1.id)!.score, "2-1", "the score changed");
  assert.equal(
    after.matches.filter((m) => m.id !== m1.id && m.hasResult).length,
    decidedDownstreamCount,
    "nothing downstream was touched - the winner never changed",
  );
});

test("enterMatchResult: changing a winner past decided descendants is refused without confirmation, and confirming voids them", async () => {
  const tournament = await createTournament({
    ...swissDraft,
    name: "Repair Cup - Winner Change",
    structure: "double-elim",
    rounds: 0,
    topCut: null,
  });
  await seatFourViaAdmin(tournament.slug);
  const event = (await getTournament(tournament.slug))!;
  await startBracket(tournament.slug, event);

  // The two round-1 winners matches are the only ones paired with real
  // players before anything is reported - m2 is m1's sibling, never
  // downstream of it, and stays the control for branch isolation below.
  const [m1, m2] = (await getBracketView(tournament.slug))!.matches.filter(
    (m) => m.bracket === "winners" && m.player1 && m.player2,
  );
  const originalWinnerId = m1.player1!.registrationId;
  const m2WinnerId = m2.player1!.registrationId;
  await enterMatchResult(tournament.slug, m1.id, 1, 0);
  await enterMatchResult(tournament.slug, m2.id, 1, 0);

  // Play out everything downstream of m1's result (winners final, the losers
  // match its loser dropped into, and that losers match's own next match) so
  // there's a multi-level chain of decided descendants to repair through -
  // but stop short of the grand final, which isn't decided yet.
  for (let guard = 0; guard < 8; guard++) {
    const open = (await getBracketView(tournament.slug))!.matches.filter(
      (m) => m.active && !m.bye && m.player1 && m.player2 && m.bracket !== "grand-final",
    );
    if (open.length === 0) break;
    for (const m of open) await enterMatchResult(tournament.slug, m.id, 1, 0);
  }

  const beforeRepair = (await getBracketView(tournament.slug))!;
  const decidedBefore = beforeRepair.matches.filter((m) => m.id !== m1.id && m.id !== m2.id && m.hasResult);
  assert.ok(decidedBefore.length >= 2, "test setup: m1's correction needs a multi-level chain to repair through");

  // Flipping the winner without confirming is refused, and changes nothing -
  // m2, its sibling, is decided too but must not be named: it's never
  // downstream of m1, only a fellow parent of the same losers-round match.
  await assert.rejects(
    () => enterMatchResult(tournament.slug, m1.id, 0, 1),
    (err: unknown) =>
      err instanceof RepairConfirmationRequired &&
      err.affectedMatchIds.length === decidedBefore.length &&
      !err.affectedMatchIds.includes(m2.id),
  );
  const unchanged = (await getBracketView(tournament.slug))!;
  assert.equal(unchanged.matches.find((m) => m.id === m1.id)!.player1!.registrationId, originalWinnerId);
  assert.equal(
    unchanged.matches.filter((m) => m.id !== m1.id && m.hasResult).length,
    decidedBefore.length + 1,
    "a rejected repair must not have voided anything (the +1 is m2, untouched throughout)",
  );

  // Confirming applies the correction and voids exactly what was named.
  await enterMatchResult(tournament.slug, m1.id, 0, 1, 0, { confirm: true });

  const repaired = (await getBracketView(tournament.slug))!;
  const repairedM1 = repaired.matches.find((m) => m.id === m1.id)!;
  // Seats (player1/player2) are fixed for the life of a match - only the
  // score entered into them changes. The original winner still sits in
  // whichever seat it always did; that seat now shows the loss.
  assert.equal(repairedM1.player1!.registrationId, originalWinnerId);
  assert.equal(repairedM1.score, "0-1", "the seat that used to win now loses, per the corrected result");
  for (const before of decidedBefore) {
    const voided = repaired.matches.find((m) => m.id === before.id)!;
    assert.equal(voided.hasResult, false, `match ${before.id} should have been voided by the repair`);
    if (before.label === "Losers Final") {
      // Two hops from m1: both of its own parents (Winners Final and Losers
      // Round 1) are themselves being repaired, so who plays here can't be
      // known until those are actually replayed - it stays unseated, not
      // reopened with stale opponents.
      assert.equal(voided.player1, null);
      assert.equal(voided.player2, null);
    } else {
      assert.ok(voided.active, `match ${before.id} (${before.label}) should be open again, waiting on whoever really advanced`);
    }
  }

  // The unrelated branch - m2 - must come through byte-for-byte unchanged.
  const repairedM2 = repaired.matches.find((m) => m.id === m2.id)!;
  assert.equal(repairedM2.hasResult, true, "m2 was never in the affected scope - it must still be decided");
  assert.equal(repairedM2.player1!.registrationId, m2WinnerId, "m2's own winner is untouched by a repair on a sibling match");
});

test("enterMatchResult: a Swiss correction that flips the winner is still refused once the next round has started", async () => {
  const tournament = await createTournament({ ...swissDraft, topCut: null });
  await seatFourViaAdmin(tournament.slug);
  const event = (await getTournament(tournament.slug))!;
  await startBracket(tournament.slug, event);

  const round1 = (await getBracketView(tournament.slug))!.matches.filter((m) => m.round === 1);
  for (const match of round1) await enterMatchResult(tournament.slug, match.id, 1, 0);
  await generateNextRound(tournament.slug);

  // No confirmation option bails this out in Swiss - there's no bracket graph
  // to repair through, only pairings that have already been recomputed.
  await assert.rejects(() => enterMatchResult(tournament.slug, round1[0].id, 0, 1, 0, { confirm: true }));
});

test("no-show: opens a few minutes in, can be dismissed, and hands over the match once its grace runs out", async () => {
  const tournament = await createTournament({ ...swissDraft, name: "No Show Cup", topCut: null });
  await seatFourViaAdmin(tournament.slug);
  const event = (await getTournament(tournament.slug))!;
  await startBracket(tournament.slug, event);

  const [match] = (await getBracketView(tournament.slug))!.matches;
  const caller = match.player1!.registrationId;
  const accused = match.player2!.registrationId;
  const pool = getPool();

  assert.equal(
    await reportNoShow(tournament.slug, match.id, caller),
    "too-early",
    "you cannot call a no-show the second the match opens",
  );

  // Four minutes in, the button is live.
  await pool.query("UPDATE match_deadlines SET active_since = ? WHERE match_id = ?", [
    toMysqlDatetimeMs(new Date(Date.now() - 4 * 60 * 1000).toISOString()),
    match.id,
  ]);
  assert.equal(await reportNoShow(tournament.slug, match.id, caller), "raised");

  const flagged = (await getBracketView(tournament.slug))!.matches.find((m) => m.id === match.id)!;
  assert.ok(flagged.noShow, "the bracket shows the call");
  assert.equal(flagged.noShow!.targetRegistrationId, accused);
  assert.ok(flagged.noShow!.autoResolvesAt, "a same-day tournament gives it a deadline of its own");
  assert.equal(flagged.hasResult, false, "calling a no-show does not decide anything by itself");

  // Being there is the whole answer to it.
  await dismissNoShow(tournament.slug, match.id, `player:${accused}`);
  assert.equal((await getBracketView(tournament.slug))!.matches.find((m) => m.id === match.id)!.noShow, null);

  // Called again, and this time nobody answers it.
  await reportNoShow(tournament.slug, match.id, caller);
  await pool.query("UPDATE match_flags SET auto_resolves_at = ? WHERE match_id = ?", [
    toMysqlDatetimeMs(new Date(Date.now() - 1000).toISOString()),
    match.id,
  ]);
  assert.equal(await resolveDueNoShows(), 1);

  const decided = (await getBracketView(tournament.slug))!.matches.find((m) => m.id === match.id)!;
  assert.equal(decided.hasResult, true, "the match went to whoever showed up");
  assert.equal(decided.player1!.win, 1);
  assert.equal(decided.noShow, null, "the call is settled, not still open");

  const [rows] = await pool.query("SELECT no_show_count FROM registrations WHERE id = ?", [accused]);
  assert.equal((rows as { no_show_count: number }[])[0].no_show_count, 1, "it goes on their record");
});

test("a moderator can disqualify a player and undo it", async () => {
  const tournament = await createTournament({ ...swissDraft, name: "Manual DQ Cup", topCut: null });
  await seatFourViaAdmin(tournament.slug);
  const event = (await getTournament(tournament.slug))!;
  await startBracket(tournament.slug, event);

  const [match] = (await getBracketView(tournament.slug))!.matches;
  const target = match.player2!.registrationId;

  await disqualifyRegistration(tournament.slug, target, "Playing a deck that was not registered", "Sky");

  const out = (await listParticipants(tournament.slug)).find((p) => p.id === target)!;
  assert.ok(out.disqualifiedAt);
  assert.equal(out.dqReason, "Playing a deck that was not registered");
  assert.equal(
    (await getBracketView(tournament.slug))!.standings.find((s) => s.registrationId === target)!.dropped,
    true,
    "a disqualified player is out of the bracket, not just labelled",
  );

  await reinstateRegistration(tournament.slug, target);
  const back = (await listParticipants(tournament.slug)).find((p) => p.id === target)!;
  assert.equal(back.disqualifiedAt, null);
  assert.equal(back.droppedAt, null);
  assert.equal(
    (await getBracketView(tournament.slug))!.standings.find((s) => s.registrationId === target)!.dropped,
    false,
    "and they are active in the bracket again",
  );
});
