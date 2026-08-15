import { teardownTestDb } from "./backend/db/test-setup.ts";

import assert from "node:assert/strict";
import test from "node:test";
import {
  cancelSignup,
  dropRegistration,
  findMyRegistrationId,
  findSignupDeckId,
  listSavedSlugsForPlayer,
  listSignupsForPlayer,
  registerSignup,
  saveTournament,
  unsaveTournament,
} from "./backend/services/registration.service.ts";
import { resolvePlayerId } from "./backend/services/player.service.ts";
import { createTournament, listParticipants, setParticipantPayment } from "./tournaments.ts";

test.after(teardownTestDb);

const draft = {
  name: "Registration Test Cup",
  startsAt: "2027-01-01T18:00:00Z",
  structure: "swiss" as const,
  rounds: 5,
  topCut: null,
  matchFormat: "Bo3" as const,
  roundLimitDays: 2,
  engine: "dueling-nexus",
  seats: 32,
  entry: { type: "free" } as const,
  host: "Test Host",
  signupUrl: "#",
};

const paidDraft = { ...draft, entry: { type: "paid" as const, amount: 10, currency: "USD" } };

async function player(name: string) {
  return resolvePlayerId(`token-${name}`, {
    name,
    avatar: "",
    contributor: false,
    contributorTime: 0,
  });
}

test("registering creates a signup, findSignupDeckId reflects it", async () => {
  const tournament = await createTournament(draft);
  const playerId = await player("Reg1");

  await registerSignup(tournament.slug, {
    playerId,
    displayName: "Reg1",
    deckId: "deck-1",
    deckName: "Wind-Up",
    entry: tournament.entry,
  });

  assert.equal(await findSignupDeckId(tournament.slug, playerId), "deck-1");
});

test("registering again with a different deck replaces it instead of duplicating", async () => {
  const tournament = await createTournament(draft);
  const playerId = await player("Reg2");

  await registerSignup(tournament.slug, {
    playerId,
    displayName: "Reg2",
    deckId: "deck-a",
    deckName: "Wind-Up",
    entry: tournament.entry,
  });
  await registerSignup(tournament.slug, {
    playerId,
    displayName: "Reg2",
    deckId: "deck-b",
    deckName: "Geargia",
    entry: tournament.entry,
  });

  assert.equal(await findSignupDeckId(tournament.slug, playerId), "deck-b");
  assert.equal((await listParticipants(tournament.slug)).length, 1);
});

test("a free tournament's signup needs no payment", async () => {
  const tournament = await createTournament(draft);
  const playerId = await player("Reg3");

  await registerSignup(tournament.slug, {
    playerId,
    displayName: "Reg3",
    deckId: "deck-1",
    deckName: "Wind-Up",
    entry: tournament.entry,
  });

  const [participant] = await listParticipants(tournament.slug);
  assert.equal(participant.paymentStatus, "not_required");
  assert.equal(participant.source, "public_signup");
});

test("a paid tournament's signup starts pending", async () => {
  const tournament = await createTournament(paidDraft);
  const playerId = await player("Reg4");

  await registerSignup(tournament.slug, {
    playerId,
    displayName: "Reg4",
    deckId: "deck-1",
    deckName: "Wind-Up",
    entry: tournament.entry,
  });

  const [participant] = await listParticipants(tournament.slug);
  assert.equal(participant.paymentStatus, "pending");
});

test("cancel removes the signup", async () => {
  const tournament = await createTournament(draft);
  const playerId = await player("Reg5");

  await registerSignup(tournament.slug, {
    playerId,
    displayName: "Reg5",
    deckId: "deck-1",
    deckName: "Wind-Up",
    entry: tournament.entry,
  });
  await cancelSignup(tournament.slug, playerId);

  assert.equal(await findSignupDeckId(tournament.slug, playerId), null);
});

test("cancelling a signup that never existed does not error", async () => {
  const tournament = await createTournament(draft);
  const playerId = await player("Reg6");
  await cancelSignup(tournament.slug, playerId);
  assert.equal(await findSignupDeckId(tournament.slug, playerId), null);
});

test("dropRegistration before the bracket starts deletes the signup, whether free or paid-unconfirmed", async () => {
  const tournament = await createTournament(draft);
  const playerId = await player("Drop1");
  await registerSignup(tournament.slug, {
    playerId,
    displayName: "Drop1",
    deckId: "deck-1",
    deckName: "Wind-Up",
    entry: tournament.entry,
  });

  assert.equal(await dropRegistration(tournament.slug, playerId), "left");
  assert.equal(await findSignupDeckId(tournament.slug, playerId), null);

  const paid = await createTournament(paidDraft);
  const paidPlayerId = await player("Drop2");
  await registerSignup(paid.slug, {
    playerId: paidPlayerId,
    displayName: "Drop2",
    deckId: "deck-1",
    deckName: "Wind-Up",
    entry: paid.entry,
  });

  assert.equal(await dropRegistration(paid.slug, paidPlayerId), "left");
  assert.equal(await findSignupDeckId(paid.slug, paidPlayerId), null);
});

test("dropRegistration is blocked once a paid signup's payment is confirmed, pre-start", async () => {
  const tournament = await createTournament(paidDraft);
  const playerId = await player("Drop3");
  await registerSignup(tournament.slug, {
    playerId,
    displayName: "Drop3",
    deckId: "deck-1",
    deckName: "Wind-Up",
    entry: tournament.entry,
  });
  const registrationId = await findMyRegistrationId(tournament.slug, playerId);
  await setParticipantPayment(tournament.slug, registrationId!, {
    status: "confirmed",
    proofUrl: null,
    by: "admin-test",
  });

  assert.equal(await dropRegistration(tournament.slug, playerId), "blocked");
  // Still registered - blocking means blocking, not a silent no-op that also drops them.
  assert.equal(await findSignupDeckId(tournament.slug, playerId), "deck-1");
});

test("dropRegistration on someone who was never registered is blocked, not an error", async () => {
  const tournament = await createTournament(draft);
  const playerId = await player("Drop4");
  assert.equal(await dropRegistration(tournament.slug, playerId), "blocked");
});

test("listSignupsForPlayer maps every registered slug to its deck", async () => {
  const a = await createTournament({ ...draft, name: "Cup A" });
  const b = await createTournament({ ...draft, name: "Cup B" });
  const playerId = await player("Reg7");

  await registerSignup(a.slug, { playerId, displayName: "Reg7", deckId: "deck-a", deckName: "A", entry: a.entry });
  await registerSignup(b.slug, { playerId, displayName: "Reg7", deckId: "deck-b", deckName: "B", entry: b.entry });

  const signups = await listSignupsForPlayer(playerId);
  assert.equal(signups.get(a.slug), "deck-a");
  assert.equal(signups.get(b.slug), "deck-b");
});

test("saving a tournament twice is a no-op, not a duplicate", async () => {
  const tournament = await createTournament(draft);
  const playerId = await player("Save1");

  await saveTournament(playerId, tournament.slug);
  await saveTournament(playerId, tournament.slug);

  const saved = await listSavedSlugsForPlayer(playerId);
  assert.deepEqual(saved, [tournament.slug]);
});

test("unsaving a tournament that was never saved does not error", async () => {
  const playerId = await player("Save2");
  await unsaveTournament(playerId, "never-saved-slug");
  assert.deepEqual(await listSavedSlugsForPlayer(playerId), []);
});

test("unsave removes exactly that tournament", async () => {
  const a = await createTournament({ ...draft, name: "Save Cup A" });
  const b = await createTournament({ ...draft, name: "Save Cup B" });
  const playerId = await player("Save3");

  await saveTournament(playerId, a.slug);
  await saveTournament(playerId, b.slug);
  await unsaveTournament(playerId, a.slug);

  assert.deepEqual(await listSavedSlugsForPlayer(playerId), [b.slug]);
});
