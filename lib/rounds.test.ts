import assert from "node:assert/strict";
import test from "node:test";
import { roundClock, roundCutoffMs, shouldAutoAdvance, type RoundTimingConfig } from "./rounds.ts";

const sameDay: RoundTimingConfig = {
  durationMode: "same_day",
  roundMinutes: 50,
  cleanupMinutes: 10,
  roundLimitDays: 2,
};
const long: RoundTimingConfig = { ...sameDay, durationMode: "long" };

const START = new Date("2026-01-01T12:00:00Z");
const at = (minutes: number) => new Date(START.getTime() + minutes * 60_000);

test("same-day rounds run on the 50 minute timer, long ones on the day limit", () => {
  assert.equal(roundCutoffMs(sameDay), 50 * 60_000);
  assert.equal(roundCutoffMs(long), 2 * 24 * 60 * 60_000);
});

test("a same-day round stays open until its deadline, then locks", () => {
  const deadlineAt = at(50);
  const open = roundClock(sameDay, { deadlineAt, allMatchesResolved: false, now: at(49) });
  assert.equal(open.locked, false);
  assert.equal(open.awaitingModerator, false);

  const closed = roundClock(sameDay, { deadlineAt, allMatchesResolved: false, now: at(50) });
  assert.equal(closed.locked, true);
  assert.equal(closed.nextRoundAt, at(60).toISOString());
});

test("same-day only advances once the cleanup window is over", () => {
  const clock = roundClock(sameDay, { deadlineAt: at(50), allMatchesResolved: false, now: at(51) });
  assert.equal(shouldAutoAdvance(clock, at(59)), false);
  assert.equal(shouldAutoAdvance(clock, at(60)), true);
});

test("a long-duration round locks when everyone reported, and then waits for a moderator", () => {
  const deadlineAt = new Date(START.getTime() + 2 * 24 * 60 * 60_000);
  const clock = roundClock(long, { deadlineAt, allMatchesResolved: true, now: at(30) });
  assert.equal(clock.locked, true);
  assert.equal(clock.awaitingModerator, true);
  assert.equal(clock.nextRoundAt, null);
  assert.equal(shouldAutoAdvance(clock, at(10_000)), false);
});

test("no open round means no deadline and nothing to lock", () => {
  const clock = roundClock(sameDay, { deadlineAt: null, allMatchesResolved: false, now: at(0) });
  assert.equal(clock.deadlineAt, null);
  assert.equal(clock.locked, false);
  assert.equal(shouldAutoAdvance(clock, at(999)), false);
});
