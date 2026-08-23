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

test("candidateGameNames covers the room hash as-is and lowercased - no NA- prefix, that's link chrome, not the reported name", () => {
  const names = candidateGameNames("AbC123");
  assert.deepEqual(new Set(names), new Set(["AbC123", "abc123"]));
});

test("disconnectCounts: no redo ever requested waits out the grace window (from discovery, not Nexus's own end_date), then counts", () => {
  const discoveredAt = new Date("2026-01-01T00:00:00Z");
  const justBefore = new Date(discoveredAt.getTime() + DISCONNECT_REDO_GRACE_MS - 1);
  const atGrace = new Date(discoveredAt.getTime() + DISCONNECT_REDO_GRACE_MS);

  assert.equal(disconnectCounts(discoveredAt.toISOString(), null, justBefore), false);
  assert.equal(disconnectCounts(discoveredAt.toISOString(), null, atGrace), true);
});

test("disconnectCounts: a disconnect discovered late still gets a full grace window from discovery, not from when it actually happened", () => {
  // The duel ended hours ago (e.g. no admin Nexus token was linked, or a
  // verification gap) - only just now discovered.
  const discoveredAt = new Date("2026-01-01T05:00:00Z");
  assert.equal(disconnectCounts(discoveredAt.toISOString(), null, discoveredAt), false);
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
