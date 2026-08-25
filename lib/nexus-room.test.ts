import assert from "node:assert/strict";
import test from "node:test";
import { generateNexusRoomHash } from "./backend/services/nexus-room.ts";

test("generateNexusRoomHash returns a 12-character base36 hash", () => {
  const hash = generateNexusRoomHash();
  assert.equal(hash.length, 12);
  assert.match(hash, /^[0-9A-Z]{12}$/);
});

test("generateNexusRoomHash's second (custom-settings) half is fixed - only the first half varies", () => {
  const hashes = Array.from({ length: 20 }, () => generateNexusRoomHash());
  const customHalves = new Set(hashes.map((h) => h.slice(6)));
  assert.equal(customHalves.size, 1, "the fixed ruleset must serialize identically every time");
});

test("generateNexusRoomHash's first (basic-settings) half varies - the randomness component keeps rooms from colliding", () => {
  const hashes = Array.from({ length: 20 }, () => generateNexusRoomHash());
  const basicHalves = new Set(hashes.map((h) => h.slice(0, 6)));
  assert.ok(basicHalves.size > 1, "20 draws from a ~8M-value range should not all collide");
});

/**
 * The two halves, read back the way Dueling Nexus's own client unpacks them:
 * `masterRule = (56 & basic) >> 3`, `banlist = 31 & custom`.
 */
function decode(hash: string) {
  const basic = Number.parseInt(hash.slice(0, 6), 36);
  const custom = Number.parseInt(hash.slice(6), 36);
  return { masterRule: (basic & 56) >> 3, banlist: custom & 31 };
}

test("a REDU room opens on the 2012.10 list under Master Rule 2", () => {
  assert.deepEqual(decode(generateNexusRoomHash("redu-2012-10")), { banlist: 10, masterRule: 2 });
  // No argument at all is a REDU room, same as before rooms knew about formats.
  assert.deepEqual(decode(generateNexusRoomHash()), { banlist: 10, masterRule: 2 });
});

test("a TCG room opens on the 2026.05 TCG list under Master Rule 5", () => {
  assert.deepEqual(decode(generateNexusRoomHash("tcg-2026-05")), { banlist: 0, masterRule: 5 });
});
