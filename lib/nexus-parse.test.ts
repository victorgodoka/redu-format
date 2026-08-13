import assert from "node:assert/strict";
import test from "node:test";
import { cleanAvatar, parseContributor, parseDeck } from "./nexus-parse.ts";

// Shape taken from a real get-info.php response.
const REAL_AVATAR =
  "https://duelingnexus.com/uploads/avatars/60e713c13966c0c6fc3bae412ecdf01f.png?k=d78b6752ae6c1be6257476c176fb26af";

test("keeps a real Nexus avatar url, query string intact", () => {
  assert.equal(cleanAvatar(REAL_AVATAR), REAL_AVATAR);
});

test("keeps a default ygopro.online avatar url", () => {
  const url = "https://ygopro.online/assets/profile/Avatars/0.jpg";
  assert.equal(cleanAvatar(url), url);
});

test("drops avatars that are not https on an expected host", () => {
  assert.equal(cleanAvatar("http://duelingnexus.com/uploads/avatars/a.png"), "");
  assert.equal(cleanAvatar("http://ygopro.online/assets/profile/Avatars/0.jpg"), "");
  assert.equal(cleanAvatar("https://evil.example/uploads/avatars/a.png"), "");
  assert.equal(cleanAvatar("https://duelingnexus.com.evil.test/a.png"), "");
  assert.equal(cleanAvatar("https://ygopro.online.evil.test/a.png"), "");
  assert.equal(cleanAvatar("javascript:alert(1)"), "");
  assert.equal(cleanAvatar("/uploads/avatars/a.png"), "");
  assert.equal(cleanAvatar(""), "");
  assert.equal(cleanAvatar(null), "");
});

test("parses the stringified contributor pair", () => {
  // Both samples are real: a non-contributor, and a contributor's time value.
  assert.deepEqual(parseContributor("[false, 0]"), {
    contributor: false,
    contributorTime: 0,
  });
  assert.deepEqual(parseContributor("[true, 2623504337]"), {
    contributor: true,
    contributorTime: 2623504337,
  });
});

test("falls back to non-contributor on anything unexpected", () => {
  for (const bad of ["", "not json", "{}", '"true"', null, undefined, 7]) {
    assert.deepEqual(
      parseContributor(bad),
      { contributor: false, contributorTime: 0 },
      `input: ${JSON.stringify(bad)}`,
    );
  }
});

// Both decks below are verbatim from a real get-info.php response.
const MELODIOUS = {
  id: "852dcf91354cd53d5db967db46f71ce8",
  name: "Melodious",
  main_deck:
    "64881644,64881644,64881644,90276649,90276649,90276649,5908650,40502912,62895219,62895219,16021142,76990617,76990617,76990617,42141493,42141493,42141493,14558128,14558128,14558128,17266660,17266660,17266660,94145022,94145022,94145022,44256816,44256816,44256816,31458630,9113513,9113513,9113513,84211599,25311006,24224830,65681983,10045474,10045474,10045474",
  extra_deck:
    "83793721,83793721,56208713,56208713,56208713,57594700,57594700,84988419,90590304,93039339,23656668,34974462,34974462,90290572,29301450",
  side_deck:
    "27204311,27204311,27204311,34267821,34267821,34267821,79757804,35269904,35269904,35269904,18144506,14532163,14532163,83326048,90846359",
};

test("counts a real deck and picks the first main deck card as cover", () => {
  assert.deepEqual(parseDeck(MELODIOUS), {
    id: "852dcf91354cd53d5db967db46f71ce8",
    name: "Melodious",
    main: 40,
    extra: 15,
    side: 15,
    coverId: 64881644,
  });
});

test("cover is a main_deck index, not a card id", () => {
  const deck = parseDeck({ ...MELODIOUS, cover: 3 });
  assert.equal(deck?.coverId, 90276649);
});

test("an out-of-range cover index falls back to the first card", () => {
  const deck = parseDeck({ ...MELODIOUS, cover: 999 });
  assert.equal(deck?.coverId, 64881644);
});

test("an empty side deck counts as zero, not one", () => {
  // The Vylon deck in the same response ships side_deck: "".
  const deck = parseDeck({ ...MELODIOUS, side_deck: "" });
  assert.equal(deck?.side, 0);
});

test("ignores non-numeric ids so the cover url cannot be steered", () => {
  const deck = parseDeck({
    ...MELODIOUS,
    main_deck: "../../etc/passwd,64881644",
  });
  assert.equal(deck?.coverId, 64881644);
  assert.equal(deck?.main, 1);
});

test("survives a deck with no main deck or no name", () => {
  const deck = parseDeck({ id: "abc", main_deck: "", extra_deck: "", side_deck: "" });
  assert.deepEqual(deck, {
    id: "abc",
    name: "Untitled",
    main: 0,
    extra: 0,
    side: 0,
    coverId: null,
  });
});

test("rejects entries that are not decks", () => {
  for (const bad of [null, undefined, "deck", 7, {}, { id: "" }]) {
    assert.equal(parseDeck(bad), null, `input: ${JSON.stringify(bad)}`);
  }
});
