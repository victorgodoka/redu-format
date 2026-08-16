import { teardownTestDb } from "./backend/db/test-setup.ts";

import assert from "node:assert/strict";
import test from "node:test";
import { getPool } from "./backend/db/client.ts";
import { toMysqlDatetimeMs } from "./backend/db/datetime.ts";
import {
  closeOverdueMatches,
  completeBracket,
  dropFromStartedTournament,
  enterMatchResult,
  generateNextRound,
  getBracketView,
  getLeaderboard,
  getPlacings,
  hasBracket,
  startBracket,
  submitMatchReport,
  type BracketView,
} from "./backend/services/results.service.ts";
import { resolvePlayerId } from "./backend/services/player.service.ts";
import { registerSignup } from "./backend/services/registration.service.ts";
import { addParticipant, createTournament, getTournament } from "./tournaments.ts";

test.after(teardownTestDb);

const swissDraft = {
  name: "Results Test Swiss",
  startsAt: "2027-01-01T18:00:00Z",
  structure: "swiss" as const,
  rounds: 2,
  topCut: 2,
  matchFormat: "Bo1" as const,
  roundLimitDays: 2,
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
  assert.deepEqual(leaderboard, []);
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

test("self-report: agreeing reports resolve a match, conflicting reports leave it disputed until a mod steps in", async () => {
  const tournament = await createTournament({ ...swissDraft, topCut: null });
  await seatFourViaAdmin(tournament.slug);

  const event = (await getTournament(tournament.slug))!;
  await startBracket(tournament.slug, event);

  const [agreeMatch, conflictMatch] = (await getBracketView(tournament.slug))!.matches;

  await submitMatchReport(tournament.slug, agreeMatch.id, agreeMatch.player1!.registrationId, "win");
  await submitMatchReport(tournament.slug, agreeMatch.id, agreeMatch.player2!.registrationId, "loss");
  const afterAgree = (await getBracketView(tournament.slug))!.matches.find((m) => m.id === agreeMatch.id)!;
  assert.equal(afterAgree.hasResult, true);
  assert.equal(afterAgree.player1!.win, 1);
  assert.equal(afterAgree.reports.length, 0, "resolved reports are cleared, not left lying around");

  await submitMatchReport(tournament.slug, conflictMatch.id, conflictMatch.player1!.registrationId, "win");
  await submitMatchReport(tournament.slug, conflictMatch.id, conflictMatch.player2!.registrationId, "win");
  const disputed = (await getBracketView(tournament.slug))!.matches.find((m) => m.id === conflictMatch.id)!;
  assert.equal(disputed.hasResult, false, "a match with two conflicting reports is not auto-resolved");
  assert.equal(disputed.disputed, true);
  assert.equal(disputed.reports.length, 2);

  // A mod's direct override resolves it and clears the dispute.
  await enterMatchResult(tournament.slug, conflictMatch.id, 1, 0);
  const resolved = (await getBracketView(tournament.slug))!.matches.find((m) => m.id === conflictMatch.id)!;
  assert.equal(resolved.hasResult, true);
  assert.equal(resolved.disputed, false);
  assert.equal(resolved.reports.length, 0);
});

test("closeOverdueMatches force-resolves a match past its round deadline, honoring a lone report", async () => {
  const tournament = await createTournament({ ...swissDraft, topCut: null, roundLimitDays: 2 });
  await seatFourViaAdmin(tournament.slug);

  const event = (await getTournament(tournament.slug))!;
  await startBracket(tournament.slug, event);

  const [reportedMatch, silentMatch] = (await getBracketView(tournament.slug))!.matches;
  await submitMatchReport(tournament.slug, reportedMatch.id, reportedMatch.player2!.registrationId, "loss");

  // Not overdue yet - the deadline job should leave everything untouched.
  assert.deepEqual(await closeOverdueMatches(tournament.slug), { resolved: 0 });

  // Push both matches' clocks back past the 2-day round limit.
  const pool = getPool();
  const backdated = toMysqlDatetimeMs(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString());
  await pool.query("UPDATE match_deadlines SET active_since = ? WHERE match_id IN (?, ?)", [
    backdated,
    reportedMatch.id,
    silentMatch.id,
  ]);

  const { resolved } = await closeOverdueMatches(tournament.slug);
  assert.equal(resolved, 2);

  const after = (await getBracketView(tournament.slug))!;
  const resolvedReported = after.matches.find((m) => m.id === reportedMatch.id)!;
  // player2 self-reported a loss with no reply from player1 - honored as-is: player2 lost.
  assert.equal(resolvedReported.hasResult, true);
  assert.equal(resolvedReported.player2!.loss, 1);

  const resolvedSilent = after.matches.find((m) => m.id === silentMatch.id)!;
  assert.equal(resolvedSilent.hasResult, true, "a fully silent match still gets force-resolved, not left stuck");

  // Both round-1 matches settled, so the swiss round itself should have advanced.
  assert.equal(after.round, 2);
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

test("closeOverdueMatches auto-drops a player after two consecutive round no-shows, leaving everyone else untouched", async () => {
  const tournament = await createTournament({ ...swissDraft, topCut: null, roundLimitDays: 2 });
  await seatFourViaAdmin(tournament.slug);
  const event = (await getTournament(tournament.slug))!;
  await startBracket(tournament.slug, event);

  const firstRound = (await getBracketView(tournament.slug))!;
  const silentPlayerId = firstRound.matches[0].player1!.registrationId;

  /** Their opponent reports on time; everyone else's match is settled instantly by an admin; only the silent player's side is left hanging past the deadline. */
  async function noShowOneRound() {
    const view = (await getBracketView(tournament.slug))!;
    const mine = view.matches.find(
      (m) =>
        m.active &&
        !m.bye &&
        (m.player1?.registrationId === silentPlayerId || m.player2?.registrationId === silentPlayerId),
    )!;
    const opponent = mine.player1?.registrationId === silentPlayerId ? mine.player2! : mine.player1!;
    await submitMatchReport(tournament.slug, mine.id, opponent.registrationId, "win");

    for (const m of view.matches.filter((match) => match.active && !match.bye && match.id !== mine.id)) {
      await enterMatchResult(tournament.slug, m.id, 1, 0);
    }

    const pool = getPool();
    const backdated = toMysqlDatetimeMs(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString());
    await pool.query(
      `UPDATE match_deadlines SET active_since = ?
       WHERE tournament_id = (SELECT id FROM tournaments WHERE slug = ?) AND match_id = ?`,
      [backdated, tournament.slug, mine.id],
    );
    await closeOverdueMatches(tournament.slug);
  }

  await noShowOneRound();
  const afterRound1 = (await getBracketView(tournament.slug))!;
  assert.equal(afterRound1.round, 2, "a fully-settled round 1 advances on its own");
  assert.equal(
    afterRound1.standings.find((s) => s.registrationId === silentPlayerId)?.dropped,
    false,
    "one missed round alone isn't enough to drop",
  );

  await noShowOneRound();
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
  const entry = leaderboard.find((row) => row.playerId === playerId);
  assert.ok(entry, "leaderboard should include the linked player");
  assert.equal(entry!.eventsPlayed, 2);
  assert.ok(entry!.totalPoints > 0);
});
