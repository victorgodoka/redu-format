import { teardownTestDb } from "./backend/db/test-setup.ts";

import assert from "node:assert/strict";
import test from "node:test";
import { getPool } from "./backend/db/client.ts";
import { RegistrationsRepository } from "./backend/repositories/registrations.repository.ts";
import { registerSignup } from "./backend/services/registration.service.ts";
import { resolvePlayerId } from "./backend/services/player.service.ts";
import { createTournament, listPublicParticipants } from "./tournaments.ts";
import { DECK_CHECK_INTERVAL_MS } from "./backend/services/deck-watch.service.ts";

test.after(teardownTestDb);

const draft = {
  name: "Deck Watch Cup",
  startsAt: "2027-01-01T18:00:00Z",
  structure: "swiss" as const,
  rounds: 3,
  topCut: null,
  matchFormat: "Bo1" as const,
  roundLimitDays: 2,
  durationMode: "same_day" as const,
  roundMinutes: 50,
  cleanupMinutes: 10,
  engine: "dueling-nexus",
  seats: 32,
  entry: { type: "free" } as const,
  host: "Test Host",
  signupUrl: "#",
};

const deck = { main: [1, 1, 2], extra: [3], side: [] };

function repo() {
  return new RegistrationsRepository(getPool());
}

/** The on-visit check only polices tournaments that are actually being played. */
async function markRunning(slug: string) {
  await getPool().query("UPDATE tournaments SET status = 'running' WHERE slug = ?", [slug]);
}

async function signUp(slug: string, name: string) {
  const playerId = await resolvePlayerId(`deck-watch-${name}`, {
    name,
    avatar: "",
    contributor: false,
    contributorTime: 0,
  });
  await registerSignup(slug, {
    playerId,
    nexusIdentityKey: `key-${name}`,
    displayName: name,
    deckId: `deck-${name}`,
    deckName: "Wind-Up",
    deckSnapshot: deck,
    entry: draft.entry,
  });
  return playerId;
}

test("a player in two running tournaments is watched in both, each with its own locked list", async () => {
  const a = await createTournament({ ...draft, name: "Deck Watch A" });
  const b = await createTournament({ ...draft, name: "Deck Watch B" });
  const playerId = await signUp(a.slug, "Multi");
  await signUp(b.slug, "Multi");
  await markRunning(a.slug);
  await markRunning(b.slug);

  const watched = await repo().listWatchedDecks({ playerId, statuses: ["running"] });
  assert.equal(watched.length, 2);
  assert.deepEqual(
    watched.map((w) => w.tournament.slug).sort(),
    [a.slug, b.slug].sort(),
  );
  // Nothing is locked before a tournament starts, so nothing is enforceable yet.
  assert.equal(watched.every((w) => w.lockedSnapshot === null), true);

  await repo().lockDeck(watched[0].registrationId, deck);
  const relocked = await repo().listWatchedDecks({ playerId, statuses: ["running"] });
  const locked = relocked.find((w) => w.registrationId === watched[0].registrationId)!;
  assert.deepEqual(locked.lockedSnapshot, deck);
});

test("a registration checked in the last 30 minutes is skipped, an older one is due again", async () => {
  const tournament = await createTournament({ ...draft, name: "Deck Watch Throttle" });
  const playerId = await signUp(tournament.slug, "Throttled");
  await markRunning(tournament.slug);

  const [watched] = await repo().listWatchedDecks({ playerId, statuses: ["running"] });
  await repo().touchDeckChecked([watched.registrationId]);

  const staleBefore = new Date(Date.now() - DECK_CHECK_INTERVAL_MS);
  assert.equal(
    (await repo().listWatchedDecks({ playerId, statuses: ["running"], checkedBefore: staleBefore })).length,
    0,
    "just checked - the 30-minute throttle holds the next upstream read back",
  );

  assert.equal(
    (await repo().listWatchedDecks({ playerId, statuses: ["running"], checkedBefore: new Date() })).length,
    1,
    "once the interval is up it is due again",
  );
});

test("a disqualification sticks, drops them out of the watch list, and shows in the public field", async () => {
  const tournament = await createTournament({ ...draft, name: "Deck Watch DQ" });
  const playerId = await signUp(tournament.slug, "Cheater");
  await markRunning(tournament.slug);

  const [watched] = await repo().listWatchedDecks({ playerId, statuses: ["running"] });
  await repo().markDisqualified(watched.registrationId, "Deck changed mid-tournament");

  assert.equal(
    (await repo().listWatchedDecks({ playerId, statuses: ["running"] })).length,
    0,
    "an already-disqualified registration is not re-checked",
  );

  const participants = await listPublicParticipants(tournament.slug);
  const row = participants.find((p) => p.id === watched.registrationId)!;
  assert.equal(row.status, "disqualified");
  assert.equal(row.reason, "Deck changed mid-tournament");

  // A second detection must not overwrite the original ruling.
  await repo().markDisqualified(watched.registrationId, "Something else");
  const again = await listPublicParticipants(tournament.slug);
  assert.equal(again.find((p) => p.id === watched.registrationId)!.reason, "Deck changed mid-tournament");
});
