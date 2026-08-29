import { teardownTestDb } from "./backend/db/test-setup.ts";

import assert from "node:assert/strict";
import test from "node:test";
import { findPlayerByName, findPlayerIdByToken, resolvePlayerId } from "./backend/services/player.service.ts";

test.after(teardownTestDb);

const profile = (over: Partial<Parameters<typeof resolvePlayerId>[1]> = {}) => ({
  name: "Godoka",
  avatar: "https://duelingnexus.com/uploads/avatars/1.png",
  contributor: false,
  contributorTime: 0,
  ...over,
});

test("resolving a new token creates a player, findPlayerIdByToken then finds it", async () => {
  const id = await resolvePlayerId("token-a", profile());
  assert.ok(id);
  assert.equal(await findPlayerIdByToken("token-a"), id);
});

test("the same token resolves to the same player every time", async () => {
  const first = await resolvePlayerId("token-b", profile());
  const second = await resolvePlayerId("token-b", profile({ contributor: true }));
  assert.equal(first, second);
});

test("an unknown token has no player yet", async () => {
  assert.equal(await findPlayerIdByToken("token-never-seen"), null);
});

test("a regenerated token reconciles onto the existing player by name, instead of forking a duplicate", async () => {
  const original = await resolvePlayerId("token-old", profile({ name: "SameName" }));

  // Token changed (regenerated on Nexus), name did not.
  const reconciled = await resolvePlayerId("token-new", profile({ name: "SameName" }));

  assert.equal(reconciled, original);
  // The old token key was reassigned onto the same player, not left pointing at a stale row.
  assert.equal(await findPlayerIdByToken("token-new"), original);
});

test("a different name with an unseen token creates a genuinely new player", async () => {
  const a = await resolvePlayerId("token-c", profile({ name: "PlayerC" }));
  const b = await resolvePlayerId("token-d", profile({ name: "PlayerD" }));
  assert.notEqual(a, b);
});

test("findPlayerByName matches regardless of casing or surrounding whitespace", async () => {
  const id = await resolvePlayerId("token-e", profile({ name: "SwordSoul King" }));

  const exact = await findPlayerByName("SwordSoul King");
  const lowercased = await findPlayerByName("swordsoul king");
  const padded = await findPlayerByName("  SwordSoul King  ");

  assert.equal(exact?.id, id);
  assert.equal(lowercased?.id, id);
  assert.equal(padded?.id, id);
});

test("findPlayerByName finds nobody for a name that truly doesn't exist", async () => {
  assert.equal(await findPlayerByName("Nobody Registered Here"), null);
});
