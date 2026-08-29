import assert from "node:assert/strict";
import test from "node:test";
import { Manager } from "tournament-organizer/components";
import type { ExportedTournamentValues } from "tournament-organizer/interfaces";
import { withField, withoutRound, withSwappedPlayers } from "./backend/services/results.service.ts";

/** A Swiss tournament shaped like the ones startBracket() creates, with no database in sight. */
function swiss(players: number) {
  const engine = new Manager().createTournament("Repair Test", {
    seating: false,
    sorting: "none",
    scoring: { bestOf: 3, win: 3, draw: 1, loss: 0, bye: 3, tiebreaks: ["solkoff"] },
    stageOne: { format: "swiss", rounds: 3, initialRound: 1 },
    stageTwo: { format: null },
  });
  for (let i = 1; i <= players; i++) engine.createPlayer(`P${i}`, `p${i}`);
  engine.startTournament();
  return engine;
}

/** Player 1 of every open match wins 2-0. */
function playRound(engine: ReturnType<typeof swiss>) {
  for (const match of engine.getActiveMatches()) {
    if (match.getPlayer2().id === null) continue;
    engine.enterResult(match.getId(), 2, 0, 0);
  }
}

const reload = (values: ExportedTournamentValues) => new Manager().loadTournament(values);

/** Order-independent name for a pairing, so two matches can be compared as sets of two. */
const pairKey = (m: { player1: { id: string | null }; player2: { id: string | null } }) =>
  [m.player1.id, m.player2.id].sort().join("|");

test("removing a round takes the matches and the players' record of them together", () => {
  const engine = swiss(8);
  playRound(engine);
  engine.nextRound();

  const before = engine.getValues() as ExportedTournamentValues;
  const roundTwoIds = before.matches.filter((m) => m.round === 2).map((m) => m.id);
  assert.equal(roundTwoIds.length, 4, "eight players pair into four matches");

  const stripped = withoutRound(before, 2);

  assert.equal(stripped.round, 1);
  assert.equal(stripped.matches.some((m) => m.round === 2), false);
  // The half that is easy to forget: each player carries their own copy.
  const leftovers = stripped.players.flatMap((p) => p.matches.filter((m) => roundTwoIds.includes(m.id)));
  assert.deepEqual(leftovers, []);
  // Round 1 is untouched - this is a re-pairing, not a rollback of the event.
  assert.equal(stripped.matches.filter((m) => m.round === 1).length, 4);
  assert.equal(
    stripped.players.every((p) => p.matches.length === 1),
    true,
    "every player keeps exactly their round 1 record",
  );
});

test("the stripped state pairs the round again, avoiding round 1 rematches", () => {
  const engine = swiss(8);
  playRound(engine);
  engine.nextRound();

  const original = engine.getValues() as ExportedTournamentValues;
  const played = new Set(original.matches.filter((m) => m.round === 1).map(pairKey));

  const repaired = reload(withoutRound(original, 2));
  repaired.nextRound();

  assert.equal(repaired.getRoundNumber(), 2);
  const fresh = repaired.getMatchesByRound(2);
  assert.equal(fresh.length, 4);

  // Everyone is in exactly one match, and nobody replays a round 1 opponent -
  // the engine pairs from the record it was handed, which is what makes the
  // surgery above correct.
  const seats = fresh.flatMap((m) => [m.getPlayer1().id, m.getPlayer2().id]);
  assert.equal(new Set(seats).size, 8);
  for (const match of fresh) {
    assert.equal(played.has(pairKey({ player1: match.getPlayer1(), player2: match.getPlayer2() })), false);
  }

  // Fresh match ids: the old lobbies, reports and duel slots are dead, which
  // is exactly why repairRound() purges the rows keyed by them.
  const oldIds = new Set(original.matches.filter((m) => m.round === 2).map((m) => m.id));
  assert.equal(fresh.some((m) => oldIds.has(m.getId())), false);
});

/**
 * Swiss pairing is not deterministic - the same standings can pair differently
 * from one draw to the next. Re-pairing is a real re-draw, not a recalculation
 * that lands back on the same table, and the admin has to be told so.
 */
test("re-pairing draws the round again rather than reproducing it", () => {
  const engine = swiss(8);
  playRound(engine);
  engine.nextRound();
  const values = engine.getValues() as ExportedTournamentValues;

  const draws = new Set<string>();
  for (let i = 0; i < 8; i++) {
    const repaired = reload(withoutRound(values, 2));
    repaired.nextRound();
    draws.add(
      repaired
        .getMatchesByRound(2)
        .map((m) => pairKey({ player1: m.getPlayer1(), player2: m.getPlayer2() }))
        .sort()
        .join(","),
    );
  }
  assert.ok(draws.size > 1, "eight re-draws of the same standings should not all be identical");
});

test("a correction in the round below is what the fresh pairings are drawn from", () => {
  const engine = swiss(8);
  playRound(engine);
  engine.nextRound();

  const stripped = withoutRound(engine.getValues() as ExportedTournamentValues, 2);
  const repaired = reload(stripped);

  // Flip round 1's first match: player 2 won it after all.
  const target = stripped.matches.find((m) => m.round === 1)!;
  const loser = target.player2.id!;
  repaired.clearResult(target.id);
  repaired.enterResult(target.id, 0, 2, 0);
  repaired.nextRound();

  // The player whose loss was corrected carries a win into the new round.
  const record = repaired.getPlayer(loser).getMatches().find((m) => m.id === target.id)!;
  assert.equal(record.win, 2);
  assert.equal(record.loss, 0);
  assert.equal(repaired.getMatchesByRound(2).length, 4);
});

/** Registrations as listParticipants() hands them over, for withField(). */
const signup = (id: string, over: { droppedAt?: string; disqualifiedAt?: string } = {}) => ({
  id,
  name: id.toUpperCase(),
  droppedAt: over.droppedAt ?? null,
  disqualifiedAt: over.disqualifiedAt ?? null,
});

test("a duelist who registered after the bracket was generated joins the re-paired round", () => {
  const engine = swiss(8);
  const values = engine.getValues() as ExportedTournamentValues;

  // p9 signed up after startBracket() froze the field, so the engine has never
  // heard of them.
  const registrations = [...Array.from({ length: 8 }, (_, i) => signup(`p${i + 1}`)), signup("p9")];
  const repaired = reload(withField(withoutRound(values, 1), registrations));

  assert.equal(repaired.getPlayers().length, 9);
  repaired.nextRound();

  const seats = repaired.getMatchesByRound(1).flatMap((m) => [m.getPlayer1().id, m.getPlayer2().id]);
  assert.ok(seats.includes("p9"), "the late entry has to be in the draw");
  // Odd field: the engine hands someone a bye rather than dropping them.
  assert.equal(seats.filter((id) => id !== null).length, 9);
});

test("drops and disqualifications are not dragged back into the field", () => {
  const engine = swiss(8);
  const values = engine.getValues() as ExportedTournamentValues;

  const registrations = [
    ...Array.from({ length: 8 }, (_, i) => signup(`p${i + 1}`)),
    signup("p9", { droppedAt: "2026-01-01T00:00:00Z" }),
    signup("p10", { disqualifiedAt: "2026-01-01T00:00:00Z" }),
  ];

  const field = withField(withoutRound(values, 1), registrations);
  assert.equal(field.players.length, 8);
  assert.equal(field.players.some((p) => p.id === "p9" || p.id === "p10"), false);
});

test("players already in the bracket keep their record when the field is synced", () => {
  const engine = swiss(8);
  playRound(engine);
  engine.nextRound();

  const values = engine.getValues() as ExportedTournamentValues;
  const registrations = [...Array.from({ length: 8 }, (_, i) => signup(`p${i + 1}`)), signup("p9")];
  const field = withField(withoutRound(values, 2), registrations);

  // Round 1 records survive; only the newcomer starts empty.
  for (const player of field.players) {
    assert.equal(player.matches.length, player.id === "p9" ? 0 : 1);
  }
});

/** The match id `playerId` currently sits in, plus their opponent's id. */
function findPairing(values: ExportedTournamentValues, playerId: string) {
  const match = values.matches.find((m) => m.player1.id === playerId || m.player2.id === playerId)!;
  const opponentId = match.player1.id === playerId ? match.player2.id : match.player1.id;
  return { matchId: match.id, opponentId };
}

test("swapping two players trades their opponents, keeping every other pairing intact", () => {
  const engine = swiss(8);
  const values = engine.getValues() as ExportedTournamentValues;

  const [matchA, matchB] = values.matches.filter((m) => m.round === 1);
  const playerA = matchA.player1.id!;
  const playerB = matchB.player1.id!;
  const untouchedA = matchA.player2.id!; // stays in matchA, faces playerB now
  const untouchedB = matchB.player2.id!; // stays in matchB, faces playerA now

  const swapped = withSwappedPlayers(values, playerA, playerB);

  assert.deepEqual(findPairing(swapped, playerA), { matchId: matchB.id, opponentId: untouchedB });
  assert.deepEqual(findPairing(swapped, playerB), { matchId: matchA.id, opponentId: untouchedA });
  assert.deepEqual(findPairing(swapped, untouchedA), { matchId: matchA.id, opponentId: playerB });
  assert.deepEqual(findPairing(swapped, untouchedB), { matchId: matchB.id, opponentId: playerA });

  // Every other round-1 match is byte-for-byte untouched.
  for (const match of values.matches.filter((m) => m.round === 1 && m.id !== matchA.id && m.id !== matchB.id)) {
    assert.deepEqual(
      swapped.matches.find((m) => m.id === match.id),
      match,
    );
  }
});

test("swapping two players moves their own match record, not just the match's player slots", () => {
  const engine = swiss(8);
  const values = engine.getValues() as ExportedTournamentValues;

  const [matchA, matchB] = values.matches.filter((m) => m.round === 1);
  const playerA = matchA.player1.id!;
  const playerB = matchB.player1.id!;

  const swapped = withSwappedPlayers(values, playerA, playerB);

  const recordFor = (id: string) => swapped.players.find((p) => p.id === id)!.matches;
  assert.equal(recordFor(playerA).length, 1);
  assert.equal(recordFor(playerA)[0].id, matchB.id);
  assert.equal(recordFor(playerB).length, 1);
  assert.equal(recordFor(playerB)[0].id, matchA.id);
});

test("swapping is a no-op if the two players are already paired against each other", () => {
  const engine = swiss(8);
  const values = engine.getValues() as ExportedTournamentValues;
  const match = values.matches.find((m) => m.round === 1)!;

  const swapped = withSwappedPlayers(values, match.player1.id!, match.player2.id!);
  assert.deepEqual(swapped, values);
});

test("swapping is a no-op if either player has no active match", () => {
  const engine = swiss(8);
  const values = engine.getValues() as ExportedTournamentValues;
  const match = values.matches.find((m) => m.round === 1)!;

  const swapped = withSwappedPlayers(values, match.player1.id!, "nobody-registered");
  assert.deepEqual(swapped, values);
});
