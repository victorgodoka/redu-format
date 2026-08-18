import { teardownTestDb } from "./backend/db/test-setup.ts";

import assert from "node:assert/strict";
import test from "node:test";
import type { RowDataPacket } from "mysql2/promise";
import { getPool } from "./backend/db/client.ts";
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
import { identityKey, resolvePlayerId } from "./backend/services/player.service.ts";
import { addParticipant, createTournament, listParticipants, setParticipantPayment } from "./tournaments.ts";

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
    nexusIdentityKey: "test-identity-key",
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
    nexusIdentityKey: "test-identity-key",
    displayName: "Reg2",
    deckId: "deck-a",
    deckName: "Wind-Up",
    entry: tournament.entry,
  });
  await registerSignup(tournament.slug, {
    playerId,
    nexusIdentityKey: "test-identity-key",
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
    nexusIdentityKey: "test-identity-key",
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
    nexusIdentityKey: "test-identity-key",
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
    nexusIdentityKey: "test-identity-key",
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
    nexusIdentityKey: "test-identity-key",
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
    nexusIdentityKey: "test-identity-key",
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
    nexusIdentityKey: "test-identity-key",
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

  await registerSignup(a.slug, {
    playerId,
    nexusIdentityKey: "test-identity-key",
    displayName: "Reg7",
    deckId: "deck-a",
    deckName: "A",
    entry: a.entry,
  });
  await registerSignup(b.slug, {
    playerId,
    nexusIdentityKey: "test-identity-key",
    displayName: "Reg7",
    deckId: "deck-b",
    deckName: "B",
    entry: b.entry,
  });

  const signups = await listSignupsForPlayer(playerId);
  assert.equal(signups.get(a.slug), "deck-a");
  assert.equal(signups.get(b.slug), "deck-b");
});

test("registerSignup snapshots the Nexus identity key used at signup, independent of players.nexus_identity_key", async () => {
  const tournament = await createTournament(draft);
  const token = "token-Snap1";
  const playerId = await player("Snap1");

  await registerSignup(tournament.slug, {
    playerId,
    nexusIdentityKey: identityKey(token),
    displayName: "Snap1",
    deckId: "deck-1",
    deckName: "Wind-Up",
    entry: tournament.entry,
  });

  const [rows] = await getPool().query<RowDataPacket[]>(
    "SELECT nexus_identity_key_snapshot FROM registrations WHERE player_id = ?",
    [playerId],
  );
  assert.equal(rows[0]?.nexus_identity_key_snapshot, identityKey(token));
});

test("an admin-manual registration has no identity snapshot - there was never a Nexus token", async () => {
  const tournament = await createTournament(draft);
  const participant = await addParticipant(tournament.slug, { name: "Manual Entry", deckName: "Geargia" });

  const [rows] = await getPool().query<RowDataPacket[]>(
    "SELECT nexus_identity_key_snapshot FROM registrations WHERE id = ?",
    [participant.id],
  );
  assert.equal(rows[0]?.nexus_identity_key_snapshot, null);
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

test("registerSignup freezes the deck list it was given, as the baseline drift checks compare against", async () => {
  const tournament = await createTournament(draft);
  const playerId = await player("Snapshot1");
  const deckSnapshot = { main: [53129443, 53129443], extra: [], side: [12580477] };

  await registerSignup(tournament.slug, {
    playerId,
    nexusIdentityKey: "snapshot-identity-key",
    displayName: "Snapshot1",
    deckId: "deck-snapshot",
    deckName: "Frozen",
    deckSnapshot,
    entry: tournament.entry,
  });

  const [rows] = await getPool().query<RowDataPacket[]>(
    "SELECT deck_snapshot FROM registrations WHERE player_id = ?",
    [playerId],
  );
  const stored = rows[0].deck_snapshot;
  assert.deepEqual(typeof stored === "string" ? JSON.parse(stored) : stored, deckSnapshot);
});

test("a signup with no readable deck list stores no baseline rather than an empty one", async () => {
  const tournament = await createTournament(draft);
  const playerId = await player("Snapshot2");

  await registerSignup(tournament.slug, {
    playerId,
    nexusIdentityKey: "snapshot-identity-key-2",
    displayName: "Snapshot2",
    deckId: "deck-no-snapshot",
    deckName: "Unfrozen",
    // @ts-expect-error - deliberately omitted: an older caller, or one that
    // could not read the list back off Nexus.
    deckSnapshot: undefined,
    entry: tournament.entry,
  });

  const [rows] = await getPool().query<RowDataPacket[]>(
    "SELECT deck_snapshot FROM registrations WHERE player_id = ?",
    [playerId],
  );
  assert.equal(rows[0].deck_snapshot, null);
});
