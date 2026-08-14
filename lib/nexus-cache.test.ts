import { teardownTestDb } from "./backend/db/test-setup.ts";

import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import {
  clearProfileCache,
  getCachedProfile,
  invalidateCachedProfile,
  setCachedProfile,
} from "./backend/services/nexus-cache.service.ts";

beforeEach(clearProfileCache);

test.after(teardownTestDb);

test("a miss returns null", async () => {
  assert.equal(await getCachedProfile("never-cached"), null);
});

test("set then get round-trips the value", async () => {
  await setCachedProfile("key-a", { name: "Godoka", decks: [] }, 60_000);
  const hit = await getCachedProfile<{ name: string; decks: unknown[] }>("key-a");
  assert.equal(hit?.value.name, "Godoka");
  assert.deepEqual(hit?.value.decks, []);
});

test("an expired entry is treated as a miss", async () => {
  await setCachedProfile("key-b", { name: "Stale" }, -1);
  assert.equal(await getCachedProfile("key-b"), null);
});

test("invalidate clears the entry so the next read misses", async () => {
  await setCachedProfile("key-c", { name: "Godoka" }, 60_000);
  await invalidateCachedProfile("key-c");
  assert.equal(await getCachedProfile("key-c"), null);
});

test("different keys do not collide", async () => {
  await setCachedProfile("key-d", { name: "D" }, 60_000);
  await setCachedProfile("key-e", { name: "E" }, 60_000);

  const d = await getCachedProfile<{ name: string }>("key-d");
  const e = await getCachedProfile<{ name: string }>("key-e");
  assert.equal(d?.value.name, "D");
  assert.equal(e?.value.name, "E");
});
