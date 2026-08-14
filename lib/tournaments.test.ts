import { teardownTestDb } from "./backend/db/test-setup.ts";

import assert from "node:assert/strict";
import test from "node:test";
import {
  addParticipant,
  createTournament,
  deleteTournament,
  getTournament,
  listParticipants,
  listTournaments,
  removeParticipant,
  setParticipantPayment,
  updateTournament,
} from "./tournaments.ts";

test.after(teardownTestDb);

const draft = {
  name: "Café Wind-Up Cup",
  startsAt: "2027-01-01T18:00:00Z",
  structure: "swiss" as const,
  rounds: 5,
  topCut: null,
  matchFormat: "Bo3" as const,
  timeLimit: 40,
  seats: 32,
  entry: { type: "free" } as const,
  host: "Test Host",
  signupUrl: "#",
};

test("create slugifies the name, strips accents, and starts at zero taken", async () => {
  const tournament = await createTournament(draft);
  assert.equal(tournament.slug, "cafe-wind-up-cup");
  assert.equal(tournament.taken, 0);
  assert.ok((await listTournaments()).some((t) => t.slug === tournament.slug));
});

test("create de-dupes a repeated name into a unique slug", async () => {
  const a = await createTournament(draft);
  const b = await createTournament(draft);
  assert.notEqual(a.slug, b.slug);
});

test("update replaces the fields but keeps the slug", async () => {
  const created = await createTournament(draft);
  const updated = await updateTournament(created.slug, { ...draft, name: "Renamed Cup", seats: 64 });
  assert.equal(updated?.slug, created.slug);
  assert.equal(updated?.name, "Renamed Cup");
  assert.equal(updated?.seats, 64);
});

test("update on a missing slug returns null", async () => {
  assert.equal(await updateTournament("does-not-exist", draft), null);
});

test("taken is derived from real registrations, not settable", async () => {
  const created = await createTournament(draft);
  assert.equal(created.taken, 0);

  const participant = await addParticipant(created.slug, { name: "Duelist", deckName: "Wind-Up" });
  assert.equal((await getTournament(created.slug))?.taken, 1);

  // Unrelated fields changing does not disturb the derived count.
  const updated = await updateTournament(created.slug, { ...draft, name: "Renamed Cup" });
  assert.equal(updated?.taken, 1);

  await removeParticipant(created.slug, participant.id);
  assert.equal((await getTournament(created.slug))?.taken, 0);
});

test("delete removes the tournament and its participants", async () => {
  const created = await createTournament(draft);
  await addParticipant(created.slug, { name: "Duelist", deckName: "Wind-Up" });

  assert.equal(await deleteTournament(created.slug), true);
  assert.equal(await getTournament(created.slug), null);
  assert.deepEqual(await listParticipants(created.slug), []);
  assert.equal(await deleteTournament(created.slug), false);
});

test("participants can be added and removed", async () => {
  const created = await createTournament(draft);
  const participant = await addParticipant(created.slug, { name: "Duelist", deckName: "Wind-Up" });

  assert.equal((await listParticipants(created.slug)).length, 1);
  assert.equal(await removeParticipant(created.slug, participant.id), true);
  assert.equal(await removeParticipant(created.slug, participant.id), false);
  assert.deepEqual(await listParticipants(created.slug), []);
});

test("a new participant starts with payment pending and no proof", async () => {
  const created = await createTournament(draft);
  const participant = await addParticipant(created.slug, { name: "Duelist", deckName: "Wind-Up" });

  assert.equal(participant.paymentStatus, "pending");
  assert.equal(participant.proofUrl, null);
  assert.equal(participant.paymentBy, null);
});

test("confirming payment records who and stamps a proof url", async () => {
  const created = await createTournament(draft);
  const participant = await addParticipant(created.slug, { name: "Duelist", deckName: "Wind-Up" });

  const confirmed = await setParticipantPayment(created.slug, participant.id, {
    status: "confirmed",
    proofUrl: "https://example.com/receipt.png",
    by: "Mod One",
  });

  assert.equal(confirmed?.paymentStatus, "confirmed");
  assert.equal(confirmed?.proofUrl, "https://example.com/receipt.png");
  assert.equal(confirmed?.paymentBy, "Mod One");
  assert.ok(confirmed?.paymentAt);
});

test("contesting keeps the disputed proof visible while pending re-approval", async () => {
  const created = await createTournament(draft);
  const participant = await addParticipant(created.slug, { name: "Duelist", deckName: "Wind-Up" });
  await setParticipantPayment(created.slug, participant.id, {
    status: "confirmed",
    proofUrl: "https://example.com/receipt.png",
    by: "Mod One",
  });

  const contested = await setParticipantPayment(created.slug, participant.id, {
    status: "contested",
    proofUrl: "https://example.com/receipt.png",
    by: "Mod Two",
  });

  assert.equal(contested?.paymentStatus, "contested");
  assert.equal(contested?.proofUrl, "https://example.com/receipt.png");
  assert.equal(contested?.paymentBy, "Mod Two");
});

test("setParticipantPayment on a missing participant returns null", async () => {
  const created = await createTournament(draft);
  const result = await setParticipantPayment(created.slug, "does-not-exist", {
    status: "confirmed",
    proofUrl: "https://example.com/receipt.png",
    by: "Mod One",
  });
  assert.equal(result, null);
});
