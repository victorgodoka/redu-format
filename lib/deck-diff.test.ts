import assert from "node:assert/strict";
import test from "node:test";
import { decksDiffer, describeDelta, diffDeckLists, parseSnapshot, type DeckSnapshot } from "./deck-diff.ts";

const DARK_HOLE = 53129443;
const RAIGEKI = 12580477;

function deck(over: Partial<DeckSnapshot> = {}): DeckSnapshot {
  return { main: [DARK_HOLE, DARK_HOLE], extra: [], side: [], ...over };
}

test("an untouched deck reports no changes", () => {
  assert.equal(decksDiffer(deck(), deck()), false);
  assert.deepEqual(diffDeckLists(deck(), deck()), []);
});

test("reordering the same cards is not a change", () => {
  const before = deck({ main: [DARK_HOLE, RAIGEKI, DARK_HOLE] });
  const after = deck({ main: [DARK_HOLE, DARK_HOLE, RAIGEKI] });
  assert.equal(decksDiffer(before, after), false);
});

test("a swapped card is reported as a removal and an addition with names", () => {
  const deltas = diffDeckLists(deck({ main: [DARK_HOLE] }), deck({ main: [RAIGEKI] }));

  assert.deepEqual(
    deltas.map((d) => ({ ...d })),
    [
      { section: "main", cardId: DARK_HOLE, cardName: "Dark Hole", before: 1, after: 0 },
      { section: "main", cardId: RAIGEKI, cardName: "Raigeki", before: 0, after: 1 },
    ],
  );
});

test("a changed copy count keeps both sides of the count", () => {
  const [delta] = diffDeckLists(deck({ main: [DARK_HOLE] }), deck({ main: [DARK_HOLE, DARK_HOLE] }));
  assert.equal(delta.before, 1);
  assert.equal(delta.after, 2);
  assert.equal(describeDelta(delta), "Main: Dark Hole (53129443) 1 -> 2");
});

test("each section is diffed on its own, so a card moved to the side deck shows both moves", () => {
  const deltas = diffDeckLists(deck({ main: [DARK_HOLE], side: [] }), deck({ main: [], side: [DARK_HOLE] }));
  assert.deepEqual(
    deltas.map((d) => [d.section, d.before, d.after]),
    [
      ["main", 1, 0],
      ["side", 0, 1],
    ],
  );
});

test("snapshots survive a JSON round trip, and junk is rejected rather than half-read", () => {
  const snapshot = deck({ extra: [RAIGEKI] });
  assert.deepEqual(parseSnapshot(JSON.stringify(snapshot)), snapshot);
  assert.deepEqual(parseSnapshot(snapshot), snapshot);
  assert.equal(parseSnapshot("not json"), null);
  assert.equal(parseSnapshot({ main: [1], extra: [] }), null, "a missing section is not an empty one");
  assert.equal(parseSnapshot(null), null);
});
