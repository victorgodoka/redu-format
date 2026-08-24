import assert from "node:assert/strict";
import test from "node:test";
import { assignPrizes, tierForPlace, type Finisher, type Prize } from "./prizing.ts";

/** Deterministic stand-in for the participation shuffle. */
const inOrder = <T,>(items: T[]): T[] => [...items];

const finishers = (count: number): Finisher[] =>
  Array.from({ length: count }, (_, i) => ({ registrationId: `r${i + 1}`, place: i + 1 }));

const prize = (id: string, tier: Prize["tier"]): Prize => ({ id, tier, code: id.toUpperCase() });

test("every placement tier ends where the next-smaller one begins", () => {
  assert.equal(tierForPlace(1), "winner");
  assert.equal(tierForPlace(2), "runner_up");
  assert.equal(tierForPlace(4), "top_4");
  assert.equal(tierForPlace(5), "top_8");
  assert.equal(tierForPlace(9), "top_16");
  assert.equal(tierForPlace(16), "top_16");
  assert.equal(tierForPlace(17), "top_32");
  assert.equal(tierForPlace(32), "top_32");
  assert.equal(tierForPlace(33), null);
});

test("a placement code only reaches its own tier, and everyone else falls back to participation", () => {
  const prizes = [prize("w", "winner"), prize("t4", "top_4"), prize("p1", "participation"), prize("p2", "participation")];
  const assignments = assignPrizes(finishers(4), prizes, inOrder);

  assert.deepEqual(assignments, [
    { prizeId: "w", registrationId: "r1" }, // 1st
    { prizeId: "p1", registrationId: "r2" }, // 2nd - no runner-up code exists
    { prizeId: "t4", registrationId: "r3" }, // 3rd
    { prizeId: "p2", registrationId: "r4" }, // 4th - the single top 4 code is gone
  ]);
});

test("one code per finisher, and codes nobody is eligible for stay unsent", () => {
  const assignments = assignPrizes(finishers(2), [prize("p1", "participation")], inOrder);
  assert.deepEqual(assignments, [{ prizeId: "p1", registrationId: "r1" }]);
});

test("dropped and disqualified players are simply not passed in", () => {
  const staying = finishers(3).filter((f) => f.registrationId !== "r2");
  const assignments = assignPrizes(staying, [prize("p1", "participation"), prize("p2", "participation")], inOrder);
  assert.deepEqual(assignments.map((a) => a.registrationId), ["r1", "r3"]);
});

test("participation codes are dealt at random, not in placing order", () => {
  const reversed = <T,>(items: T[]): T[] => [...items].reverse();
  const prizes = [prize("p1", "participation"), prize("p2", "participation")];
  const assignments = assignPrizes(finishers(2), prizes, reversed);
  assert.deepEqual(assignments, [
    { prizeId: "p2", registrationId: "r1" },
    { prizeId: "p1", registrationId: "r2" },
  ]);
});
