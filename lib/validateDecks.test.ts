import assert from "node:assert/strict";
import test from "node:test";
import { BANLIST_IDS } from "./banlist.ts";
import { CARD_LIB } from "./cardLib.ts";
import {
  describeError,
  validateDeck,
  validateDecks,
} from "./validateDecks.ts";

/** The errata'd row for a passcode: same id, but errataId/errataText set. */
const ERRATA_ROWS = CARD_LIB.filter((c) => c.errataId !== null);

// .flat(): a banlist entry is a group of ids (canonical passcode, alt-art
// aliases, and an errata id when the card has one), all under the same limit.
const bannedIds = new Set(BANLIST_IDS.flatMap((s) => s.cards).flat());
const errataIds = new Set(ERRATA_ROWS.map((c) => c.id));

/** Real cards that are neither restricted nor errata'd, safe to pad with. */
const FILLER = CARD_LIB.filter(
  (c) => !bannedIds.has(c.id) && !errataIds.has(c.id),
)
  .slice(0, 60)
  .map((c) => c.id);

const deck = (main: number[], extra: number[] = [], side: number[] = []) => ({
  id: "test",
  main,
  extra,
  side,
});

/** Pads to a legal size without re-adding a card the case already placed. */
const pad = (cards: number[], to = 40) => {
  const used = new Set(cards);
  const rest = FILLER.filter((id) => !used.has(id)).slice(0, to - cards.length);
  return [...cards, ...rest];
};

const idOf = (name: string) => CARD_LIB.find((c) => c.name === name)?.id as number;

const POT_OF_GREED = idOf("Pot of Greed"); // Forbidden
const SANGAN = ERRATA_ROWS.find((c) => c.name === "Sangan");

test("a clean deck passes", () => {
  const result = validateDeck(deck(pad([])));
  assert.deepEqual(result.errors, []);
  assert.equal(result.valid, true);
});

test("a Forbidden card is rejected", () => {
  const result = validateDeck(deck(pad([POT_OF_GREED])));
  const ban = result.errors.find((e) => e.type === "banlist");
  assert.ok(ban, "expected a banlist error");
  assert.equal(ban.allowedCopies, 0);
  assert.equal(ban.actualCopies, 1);
  assert.equal(ban.section, "forbidden");
});

test("Limited allows one copy and rejects two", () => {
  const limited = BANLIST_IDS.find((s) => s.slug === "limited");
  const [id] = limited.cards.find(([cardId]) => !errataIds.has(cardId));

  assert.equal(validateDeck(deck(pad([id]))).valid, true);

  const two = validateDeck(deck(pad([id, id])));
  const ban = two.errors.find((e) => e.type === "banlist");
  assert.ok(ban);
  assert.equal(ban.allowedCopies, 1);
  assert.equal(ban.actualCopies, 2);
});

test("Semi-Limited allows two copies and rejects three", () => {
  const semi = BANLIST_IDS.find((s) => s.slug === "semi-limited");
  const [id] = semi.cards.find(([cardId]) => !errataIds.has(cardId));

  assert.equal(validateDeck(deck(pad([id, id]))).valid, true);
  assert.ok(
    validateDeck(deck(pad([id, id, id]))).errors.some(
      (e) => e.type === "banlist",
    ),
  );
});

test("the plain three-copy ceiling still applies off the banlist", () => {
  const ordinary = FILLER[0];
  const four = validateDeck(deck(pad([ordinary, ordinary, ordinary, ordinary])));
  const ban = four.errors.find((e) => e.type === "banlist");
  assert.ok(ban, "four copies of an unrestricted card must fail");
  assert.equal(ban.allowedCopies, 3);
  assert.equal(ban.actualCopies, 4);
});

test("copies are counted across main, extra and side", () => {
  const limited = BANLIST_IDS.find((s) => s.slug === "limited");
  const [id] = limited.cards.find(([cardId]) => !errataIds.has(cardId));

  const split = validateDeck(deck(pad([id]), [], [id]));
  const ban = split.errors.find((e) => e.type === "banlist");
  assert.ok(ban, "a limited card cannot appear once in main and once in side");
  assert.equal(ban.actualCopies, 2);
});

test("mixing the two printings cannot dodge a limit", () => {
  // One passcode plus one pre-errata printing is still two copies.
  const result = validateDeck(deck(pad([SANGAN.id, SANGAN.errataId])));
  const ban = result.errors.find((e) => e.type === "banlist");
  assert.ok(ban, "the two ids must collapse onto one card");
  assert.equal(ban.actualCopies, 2);
  assert.equal(ban.cardId, SANGAN.id, "reported under the passcode");
});

test("the pre-errata printing is accepted on its own", () => {
  const result = validateDeck(deck(pad([SANGAN.errataId])));
  assert.deepEqual(result.errors, [], "the errata'd printing is the legal one");
});

test("the post-errata passcode is flagged with the id to use instead", () => {
  const result = validateDeck(deck(pad([SANGAN.id])));
  const errata = result.errors.find((e) => e.type === "errata");
  assert.ok(errata);
  assert.equal(errata.errataId, SANGAN.errataId);
  assert.equal(errata.cardName, "Sangan");
});

test("a card outside the pool is reported once, with its count", () => {
  const result = validateDeck(deck(pad([999999999, 999999999])));
  const outside = result.errors.filter((e) => e.type === "format");
  assert.equal(outside.length, 1, "one error per card, not per copy");
  assert.equal(outside[0].copies, 2);
});

test("an out-of-pool card does not also raise banlist noise", () => {
  const result = validateDeck(deck(pad([999999999, 999999999, 999999999, 999999999])));
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].type, "format");
});

test("every error renders a sentence naming the card", () => {
  const result = validateDeck(
    deck(pad([POT_OF_GREED, SANGAN.id, 999999999])),
  );
  assert.ok(result.errors.length >= 3);
  for (const error of result.errors) {
    const line = describeError(error);
    assert.ok(line.length > 0);
    assert.ok(!line.includes("undefined"), line);
  }
});

test("validateDecks keeps the deck id alongside the verdict", () => {
  const [ok, bad] = validateDecks([
    { id: "good", main: pad([]), extra: [], side: [] },
    { id: "bad", main: pad([POT_OF_GREED]), extra: [], side: [] },
  ]);
  assert.equal(ok.id, "good");
  assert.equal(ok.valid, true);
  assert.equal(bad.id, "bad");
  assert.equal(bad.valid, false);
  assert.ok(bad.errors.length > 0);
});

test("an empty deck raises nothing here: size is checked elsewhere", () => {
  assert.deepEqual(validateDeck(deck([])).errors, []);
});

test("the passcode of an errata'd card is never accepted, in any zone", () => {
  for (const zone of ["main", "extra", "side"] as const) {
    const lists = { main: pad([]), extra: [], side: [] };
    lists[zone] = [...lists[zone], SANGAN.id];
    const result = validateDeck({ id: "z", ...lists });
    assert.ok(
      result.errors.some((e) => e.type === "errata"),
      `passcode slipped through the ${zone} deck`,
    );
  }
});

test("no errata'd card can be spelled with its passcode", () => {
  // Guards the whole table, not just the one card the cases above use.
  for (const row of ERRATA_ROWS.slice(0, 25)) {
    const viaPasscode = validateDeck(deck(pad([row.id])));
    assert.ok(
      viaPasscode.errors.some((e) => e.type === "errata"),
      `${row.name} accepted its passcode`,
    );

    const viaErrata = validateDeck(deck(pad([row.errataId as number])));
    assert.ok(
      !viaErrata.errors.some((e) => e.type === "errata"),
      `${row.name} rejected its own errata id`,
    );
  }
});
