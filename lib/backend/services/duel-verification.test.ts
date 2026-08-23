import assert from "node:assert/strict";
import test from "node:test";
import {
  candidateGameNames,
  disconnectCounts,
  DISCONNECT_REDO_GRACE_MS,
} from "./duel-verification.service.ts";
import type { RedoRequest } from "../repositories/redo-requests.repository.ts";

function redo(overrides: Partial<RedoRequest>): RedoRequest {
  return {
    id: "r1",
    duelAttemptId: "a1",
    requesterRegistrationId: "p1",
    playerARegistrationId: "p1",
    playerBRegistrationId: "p2",
    playerAConsent: true,
    playerBConsent: false,
    status: "pending",
    expiresAt: new Date().toISOString(),
    replacementRoomHash: null,
    ...overrides,
  };
}

test("candidateGameNames covers the bare hash and the NA- link form, case-insensitively", () => {
  const names = candidateGameNames("AbC123");
  for (const expected of ["AbC123", "NA-AbC123", "ABC123", "NA-ABC123", "abc123", "NA-abc123"]) {
    assert.ok(names.includes(expected), `expected ${expected} in ${JSON.stringify(names)}`);
  }
});

test("disconnectCounts: no redo ever requested waits out the grace window, then counts", () => {
  const end = new Date("2026-01-01T00:00:00Z");
  const justBefore = new Date(end.getTime() + DISCONNECT_REDO_GRACE_MS - 1);
  const atGrace = new Date(end.getTime() + DISCONNECT_REDO_GRACE_MS);

  assert.equal(disconnectCounts(end.toISOString(), null, justBefore), false);
  assert.equal(disconnectCounts(end.toISOString(), null, atGrace), true);
  assert.equal(disconnectCounts(null, null, atGrace), false); // no known end time - never guessed at.
});

test("disconnectCounts: a pending request always waits, regardless of the clock", () => {
  const now = new Date("2026-01-01T01:00:00Z");
  assert.equal(disconnectCounts(new Date(0).toISOString(), redo({ status: "pending" }), now), false);
});

test("disconnectCounts: an accepted redo never counts - the replacement attempt is what matters now", () => {
  const now = new Date("2026-01-01T01:00:00Z");
  assert.equal(disconnectCounts(new Date(0).toISOString(), redo({ status: "accepted" }), now), false);
});

test("disconnectCounts: a rejected or expired request falls back to the normal disconnect rule immediately", () => {
  const now = new Date("2026-01-01T00:00:01Z"); // well within the grace window on its own
  assert.equal(disconnectCounts(now.toISOString(), redo({ status: "rejected" }), now), true);
  assert.equal(disconnectCounts(now.toISOString(), redo({ status: "expired" }), now), true);
});
