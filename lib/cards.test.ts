import assert from "node:assert/strict";
import test from "node:test";
import { BANLIST_IDS } from "./banlist.ts";
import { parseCardText } from "./card-text.ts";
import { Card, cardsByIds, findCardByName } from "./cards.ts";
import { ERRATAS } from "./erratas.ts";

test("resolves a card that never received an errata", () => {
  // 53129443 is Dark Hole, a passcode stable enough to hard-code.
  const card = new Card(53129443);
  assert.equal(card.found, true);
  assert.equal(card.name, "Dark Hole");
  assert.ok(card.desc.length > 0);
  assert.equal(card.hasErrata, false);
  assert.equal(card.errataId, null);
  assert.equal(card.printId, card.id);
});

test("an errata'd card keeps its passcode and gains the internal ids", () => {
  const card = new Card(8131171);
  assert.equal(card.name, "Sinister Serpent");
  assert.equal(card.id, 8131171, "the passcode must survive the errata");
  assert.equal(card.hasErrata, true);
  assert.equal(card.errataId, 8131191);
  assert.equal(card.printId, 8131191, "the errata'd scan is the one to show");
  assert.equal(card.koid, 4481);
});

test("errataId is always the passcode plus twenty", () => {
  for (const errata of ERRATAS) {
    assert.equal(errata.errataId, errata.id + 20, `${errata.name}`);
  }
});

test("koid is never confused with the passcode", () => {
  for (const errata of ERRATAS) {
    assert.notEqual(errata.koid, errata.id, `${errata.name}`);
    assert.ok(errata.koid > 0);
  }
});

test("the errata table wins over the card library", () => {
  // Stratos is in both sources; the errata text is the one that must show.
  const card = new Card(40044918);
  const errata = ERRATAS.find((e) => e.id === 40044918);
  assert.ok(errata);
  assert.equal(card.desc, errata.desc);
  assert.equal(card.name, "Elemental HERO Stratos");
});

test("cards outside the library still resolve from the errata table", () => {
  // Firewall Dragon postdates this format's library but is in the CSV.
  const card = new Card(5043010);
  assert.equal(card.found, true);
  assert.equal(card.name, "Firewall Dragon");
  assert.equal(card.koid, 13082);
});

test("an unknown id is reported rather than silently blank", () => {
  const card = new Card(1);
  assert.equal(card.found, false);
  assert.equal(card.id, 1);
  assert.ok(card.name.includes("Unknown"));
});

test("rulings link uses the koid when there is one", () => {
  const serpent = new Card(8131171);
  assert.equal(serpent.rulingsUrl, "https://db.ygoresources.com/card#4481");
});

test("cards without an errata still get a koid from the library", () => {
  const darkHole = new Card(53129443);
  assert.equal(darkHole.hasErrata, false);
  assert.equal(typeof darkHole.koid, "number");
  assert.equal(darkHole.rulingsUrl, "https://db.ygoresources.com/card#" + darkHole.koid);
});

test("every banlist card can link straight to its rulings", () => {
  const ids = BANLIST_IDS.flatMap((s) => s.cards.map(([id]) => id));
  const noKoid = ids.map((id) => new Card(id)).filter((c) => c.koid === null);
  assert.deepEqual(noKoid.map((c) => c.name), [], "cards falling back to name search");
});

test("the pre-errata text is the one shown", () => {
  // The passcode scan carries the new text; errataId carries this wording.
  const serpent = new Card(8131171);
  assert.match(serpent.desc, /exists in your Graveyard/);
  assert.doesNotMatch(serpent.desc, /also banish/);
});

test("every banlist id resolves to a real card", () => {
  const ids = BANLIST_IDS.flatMap((s) => s.cards.map(([id]) => id));
  const unknown = ids.filter((id) => !new Card(id).found);
  assert.deepEqual(unknown, [], "banlist ids missing from both sources");
  assert.equal(cardsByIds(ids).length, ids.length);
});

test("lookup by name round-trips", () => {
  assert.equal(findCardByName("  dark HOLE ")?.id, 53129443);
  assert.equal(findCardByName("sinister serpent")?.koid, 4481);
  assert.equal(findCardByName("not a real card"), null);
});

test("toJSON carries what the client needs and nothing heavier", () => {
  const json = new Card(8131171).toJSON();
  assert.deepEqual(Object.keys(json).sort(), [
    "desc",
    "errataId",
    "id",
    "koid",
    "name",
    "printId",
    "rulingsUrl",
  ]);
});

test("card text splits into plain and bold runs without losing characters", () => {
  const parts = parseCardText("Foo [b]Cannot[/b] bar [b]then[/b].");
  assert.deepEqual(parts, [
    { text: "Foo ", bold: false },
    { text: "Cannot", bold: true },
    { text: " bar ", bold: false },
    { text: "then", bold: true },
    { text: ".", bold: false },
  ]);
});

test("card text with no markup passes through whole", () => {
  assert.deepEqual(parseCardText("Plain text."), [
    { text: "Plain text.", bold: false },
  ]);
  assert.deepEqual(parseCardText(""), []);
});

test("no [b] markup survives into rendered runs", () => {
  for (const errata of ERRATAS) {
    const joined = parseCardText(errata.desc)
      .map((p) => p.text)
      .join("");
    assert.ok(!joined.includes("[b]"), `${errata.name} kept an open tag`);
    assert.ok(!joined.includes("[/b]"), `${errata.name} kept a close tag`);
  }
});
