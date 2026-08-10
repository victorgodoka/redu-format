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
  updateTournament,
} from "./tournaments.ts";

const draft = {
  name: "Café Wind-Up Cup",
  startsAt: "2027-01-01T18:00:00Z",
  structure: "swiss" as const,
  rounds: 5,
  topCut: null,
  matchFormat: "Bo3" as const,
  timeLimit: 40,
  seats: 32,
  entry: "Free entry",
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
  const updated = await updateTournament(created.slug, { ...draft, name: "Renamed Cup", seats: 64, taken: 10 });
  assert.equal(updated?.slug, created.slug);
  assert.equal(updated?.name, "Renamed Cup");
  assert.equal(updated?.seats, 64);
  assert.equal(updated?.taken, 10);
});

test("update on a missing slug returns null", async () => {
  assert.equal(await updateTournament("does-not-exist", { ...draft, taken: 0 }), null);
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
