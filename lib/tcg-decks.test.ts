import assert from "node:assert/strict";
import test from "node:test";
import { validateDeckFor, validateTcgDeck } from "./tcg-decks.ts";
import type { NexusDeckLists } from "./nexus-parse.ts";

// Real ids out of lib/cardinfo.json, the source of truth this validates against.
const FORBIDDEN = 21044178; // Abyss Dweller
const LIMITED = 80181649; // "A Case for K9"
const SEMI = 33760966; // Dracotail Arthalion
const FREE = 34541863; // "A" Cell Breeding Device
const OCG_ONLY = 100458025; // "Raise Moon" the City that Never Sleeps
const RARITY_OFFSET = 100_000_000_000;

const deck = (main: number[]): NexusDeckLists =>
  ({ id: "d", name: "Test", main, extra: [], side: [] }) as NexusDeckLists;

test("copies are held to the TCG banlist", () => {
  assert.equal(validateTcgDeck(deck([FREE, FREE, FREE])).valid, true);
  assert.equal(validateTcgDeck(deck([SEMI, SEMI])).valid, true);
  assert.equal(validateTcgDeck(deck([LIMITED])).valid, true);

  const overSemi = validateTcgDeck(deck([SEMI, SEMI, SEMI]));
  assert.equal(overSemi.valid, false);
  assert.deepEqual(
    overSemi.errors.map((e) => e.type === "banlist" && [e.allowedCopies, e.actualCopies]),
    [[2, 3]],
  );

  const forbidden = validateTcgDeck(deck([FORBIDDEN]));
  assert.equal(forbidden.errors[0]?.type, "banlist");
});

test("a card that never reached the TCG is called out by name, not as a missing id", () => {
  const result = validateTcgDeck(deck([OCG_ONLY]));
  assert.equal(result.errors[0]?.type, "not-tcg");
});

test("rarity digits are stripped before the lookup", () => {
  assert.equal(validateTcgDeck(deck([FREE + 3 * RARITY_OFFSET])).valid, true);
  // ...and the rarities of one card still count as that one card.
  const tooMany = validateTcgDeck(deck([SEMI, SEMI + RARITY_OFFSET, SEMI + 2 * RARITY_OFFSET]));
  assert.equal(tooMany.valid, false);
});

test("an alternate art id listed in card_images resolves to its card", () => {
  // "Aleister the Invoker": the alternate print sits one *below* the passcode,
  // so only card_images can find it - walking down never would.
  const ALEISTER = 86120752;
  const ALEISTER_ALT = 86120751;
  assert.equal(validateTcgDeck(deck([ALEISTER_ALT])).valid, true);
  // Both printings are the same card, so three copies is still three copies.
  const mixed = validateTcgDeck(deck([ALEISTER, ALEISTER_ALT, ALEISTER, ALEISTER_ALT]));
  assert.equal(mixed.errors[0]?.type, "banlist");
});

test("an alt-art id resolves to the print a few ids below it", () => {
  assert.equal(validateTcgDeck(deck([FREE + 5])).valid, true);
  // Six above is past the search window, so it reads as an id nobody knows.
  const missed = validateTcgDeck(deck([FREE + 6]));
  assert.deepEqual(
    missed.errors.map((e) => (e.type === "unknown" ? e.cardIds : null)),
    [[FREE + 6]],
  );
});

test("unknown ids are reported together, once", () => {
  const result = validateTcgDeck(deck([999_999_997, 999_999_997, 999_999_996]));
  assert.equal(result.errors.length, 1);
  assert.deepEqual(
    result.errors[0].type === "unknown" ? result.errors[0].cardIds : [],
    [999_999_997, 999_999_996],
  );
});

test("only a TCG tournament routes here - anything else stays on the REDU pool", () => {
  // Modern card, legal in the TCG, nowhere near the frozen 2012 pool.
  assert.equal(validateDeckFor("tcg-2026-05", deck([LIMITED])).valid, true);
  assert.equal(validateDeckFor("redu-2012-10", deck([LIMITED])).valid, false);
  assert.equal(validateDeckFor(undefined, deck([LIMITED])).valid, false);
});
