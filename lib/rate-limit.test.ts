import { teardownTestDb } from "./backend/db/test-setup.ts";

import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { rateLimit, resetRateLimits } from "./rate-limit.ts";

beforeEach(resetRateLimits);

test.after(teardownTestDb);

test("allows up to the limit, then blocks", async () => {
  for (let i = 0; i < 8; i++) {
    assert.equal(await rateLimit("1.2.3.4"), true, `attempt ${i + 1}`);
  }
  assert.equal(await rateLimit("1.2.3.4"), false);
  assert.equal(await rateLimit("1.2.3.4"), false);
});

test("keys are independent", async () => {
  for (let i = 0; i < 8; i++) await rateLimit("1.2.3.4");
  assert.equal(await rateLimit("1.2.3.4"), false);
  assert.equal(await rateLimit("5.6.7.8"), true);
});

test("window expiry lets the key through again", async () => {
  // Each hit is a real DB round trip, so the window has to be wide enough that
  // the calls below it can't themselves eat into it (unlike the old in-memory
  // version, where every call was effectively instant).
  for (let i = 0; i < 2; i++) await rateLimit("slow", 2, 300);
  assert.equal(await rateLimit("slow", 2, 300), false);

  await new Promise((r) => setTimeout(r, 400));
  assert.equal(await rateLimit("slow", 2, 300), true);
});
