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
