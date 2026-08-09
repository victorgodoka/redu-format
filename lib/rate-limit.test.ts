import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { rateLimit, resetRateLimits } from "./rate-limit.ts";

beforeEach(resetRateLimits);

test("allows up to the limit, then blocks", () => {
  for (let i = 0; i < 8; i++) {
    assert.equal(rateLimit("1.2.3.4"), true, `attempt ${i + 1}`);
  }
  assert.equal(rateLimit("1.2.3.4"), false);
  assert.equal(rateLimit("1.2.3.4"), false);
});

test("keys are independent", () => {
  for (let i = 0; i < 8; i++) rateLimit("1.2.3.4");
  assert.equal(rateLimit("1.2.3.4"), false);
  assert.equal(rateLimit("5.6.7.8"), true);
});

test("window expiry lets the key through again", async () => {
  for (let i = 0; i < 2; i++) rateLimit("slow", 2, 40);
  assert.equal(rateLimit("slow", 2, 40), false);

  await new Promise((r) => setTimeout(r, 60));
  assert.equal(rateLimit("slow", 2, 40), true);
});
