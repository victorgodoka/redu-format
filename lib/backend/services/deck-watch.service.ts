import { createHash } from "node:crypto";
import {
  describeDelta,
  diffDeckLists,
  parseSnapshot,
  toSnapshot,
  type DeckCardDelta,
  type DeckSnapshot,
} from "../../deck-diff.ts";
import { fetchDeckArt } from "../../nexus-parse.ts";
import { getPool } from "../db/client.ts";
import { DeckSnapshotsRepository } from "../repositories/deck-snapshots.repository.ts";
import { RegistrationsRepository, type WatchedDeck } from "../repositories/registrations.repository.ts";
import { notify } from "./notifications.service.ts";

export const DECK_DQ = "deck.disqualified";

/** A player is only policed while a tournament they're in is actually being played. */
const ONGOING = ["running"];

/**
 * How often one registration is re-checked against Dueling Nexus while its
 * tournament is running. The throttle is a cost control on the upstream call
 * only: the check it gates always re-reads the registration row and the live
 * deck, never anything the browser sent.
 */
export const DECK_CHECK_INTERVAL_MS = 30 * 60 * 1000;

export type DeckMismatchMetadata = {
  deckId: string;
  deckName: string;
  tournament: WatchedDeck["tournament"];
  /** Present on the admin copy only - who changed their deck, with no credential of theirs attached. */
  player?: WatchedDeck["player"];
  /** Present on the admin copy only - the old-vs-new comparison. */
  changes?: DeckCardDelta[];
  /** Present on the player copy only - the deck exactly as it was locked at the start. */
  registered?: DeckSnapshot;
};

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function summarise(deltas: DeckCardDelta[]): string {
  const lines = deltas.slice(0, 12).map(describeDelta);
  if (deltas.length > lines.length) lines.push(`...and ${deltas.length - lines.length} more changes`);
  return lines.join("\n");
}

function repo() {
  return new RegistrationsRepository(getPool());
}

function snapshotsRepo() {
  return new DeckSnapshotsRepository(getPool());
}

/** The deck exactly as Dueling Nexus serves it right now, or null when it can't be read (private, deleted, upstream down). */
async function liveSnapshot(deckId: string): Promise<DeckSnapshot | null> {
  const live = await fetchDeckArt(deckId);
  // toSnapshot, not a hand-built object: it is what strips the rarity digits.
  return live ? toSnapshot(live) : null;
}

/**
 * Freezes every registered deck as it stands right now, and records the
 * freeze in the deck_snapshots audit history - called once per round, before
 * that round's lobbies are generated (startBracket() for round 1,
 * generateNextRound() for every round after). Whatever a player did to their
 * list before this moment is legal and raises nothing; from here on, that
 * frozen list is the only one they are allowed to play until the next round
 * re-freezes it.
 *
 * Falls back to the snapshot taken at signup when Nexus can't be reached, so
 * a round never opens with an unenforceable (null) baseline.
 */
async function freezeDecks(slug: string, roundNumber: number): Promise<number> {
  const registrations = repo();
  const snapshots = snapshotsRepo();
  const watched = await registrations.listWatchedDecks({ slug });
  const now = new Date();

  const locked = await Promise.all(
    watched.map(async (w) => {
      const snapshot = (await liveSnapshot(w.deckId).catch(() => null)) ?? parseSnapshot(w.deckSnapshot);
      if (!snapshot) return false;
      await registrations.lockDeck(w.registrationId, snapshot);
      await snapshots.record({
        id: crypto.randomUUID(),
        registrationId: w.registrationId,
        kind: "round_start",
        roundNumber,
        snapshot,
        now,
      });
      return true;
    }),
  );
  return locked.filter(Boolean).length;
}

/** Round 1's freeze - called from startBracket(), before the first round's lobbies are generated. */
export async function lockTournamentDecks(slug: string): Promise<number> {
  return freezeDecks(slug, 1);
}

/** Every later round's freeze - called from generateNextRound(), before that round's lobbies are generated. */
export async function snapshotRoundDecks(slug: string, roundNumber: number): Promise<number> {
  return freezeDecks(slug, roundNumber);
}

/**
 * Disqualifies a registration: the DQ is recorded on the row (permanent, and
 * what every list and page reads back), the player is taken out of the
 * bracket exactly like a drop, and both they and the staff are told why.
 *
 * results.service.ts imports this module, so the drop is pulled in
 * dynamically to keep that cycle from being a load-order problem.
 */
async function disqualify(watched: WatchedDeck, changes: DeckCardDelta[], locked: DeckSnapshot): Promise<void> {
  const { player, tournament, deckId, deckName, registrationId } = watched;
  const reason = `Deck differs from the list locked at the start of ${tournament.name} (${changes.length} change${changes.length === 1 ? "" : "s"})`;

  await repo().markDisqualified(registrationId, reason);

  const { dropFromStartedTournament } = await import("./results.service.ts");
  // A DQ'd player is out of the bracket; a tournament that has since finished
  // (or a registration already out) leaves the recorded DQ standing on its own.
  await dropFromStartedTournament(tournament.slug, registrationId).catch(() => {});

  const base: DeckMismatchMetadata = { deckId, deckName, tournament };

  await notify({
    id: crypto.randomUUID(),
    audience: "admin",
    playerId: null,
    kind: DECK_DQ,
    title: `Disqualified - ${player.name} in ${tournament.name}`,
    body:
      `${player.name} was disqualified from ${tournament.name}: the deck "${deckName}" (${deckId}) ` +
      `no longer matches the list locked when the tournament started. ${changes.length} change${changes.length === 1 ? "" : "s"}:\n` +
      summarise(changes),
    metadata: { ...base, player, changes },
    fingerprint: hash(`admin|${DECK_DQ}|${registrationId}`),
  });

  await notify({
    id: crypto.randomUUID(),
    audience: "player",
    playerId: player.id,
    kind: DECK_DQ,
    title: `You have been disqualified from ${tournament.name}`,
    body:
      `You are DISQUALIFIED from ${tournament.name}. The deck "${deckName}" (${deckId}) you are playing is not ` +
      `the list that was locked in when the tournament started, and decks are frozen for the whole event. ` +
      `This is automatic and takes effect immediately - the list you were required to play is below. ` +
      `Contact a Tournament Organizer if you believe this is a mistake.`,
    metadata: { ...base, registered: locked },
    fingerprint: hash(`player|${player.id}|${DECK_DQ}|${registrationId}`),
  });
}

/**
 * Compares one registration's live deck against the list locked at the start
 * of its tournament, and disqualifies on any difference - detection is the
 * penalty, there is no warning step. The comparison always runs against the
 * stored tournament records (the locked snapshot on the registration row) and
 * a fresh read from Dueling Nexus; nothing the client sends is consulted.
 *
 * Returns false - not a DQ - when there is no locked baseline yet, or when
 * Nexus can't be reached or the deck was made private or deleted: none of
 * those are evidence of an edit, and firing on them would turn an upstream
 * blip into an accusation.
 */
export async function enforceWatchedDeck(watched: WatchedDeck): Promise<boolean> {
  const locked = parseSnapshot(watched.lockedSnapshot);
  if (!locked) return false;

  const current = await liveSnapshot(watched.deckId);
  if (!current) return false;

  const changes = diffDeckLists(locked, current);
  if (changes.length === 0) return false;

  await disqualify(watched, changes, locked);
  return true;
}

async function enforce(watched: WatchedDeck[]): Promise<number> {
  // ponytail: one upstream call per registration, all in flight at once - fine
  // at event sizes this site runs. Batch or queue it if a sweep ever spans
  // hundreds of decks at once.
  const results = await Promise.all(
    // One unreachable deck must not abort the rest of the sweep, and none of
    // this is worth failing a round generation or a page render over.
    watched.map((w) => enforceWatchedDeck(w).catch(() => false)),
  );
  // Checked means "we looked", pass or fail - a deck that couldn't be read
  // waits out the same interval as one that matched, instead of being retried
  // on every single page view.
  await repo().touchDeckChecked(watched.map((w) => w.registrationId));
  return results.filter(Boolean).length;
}

/** Every locked deck in one running tournament: the checkpoint at each new round. Not throttled - a round boundary is rare and worth a full pass. */
export async function enforceTournamentDecks(slug: string): Promise<number> {
  return enforce(await repo().listWatchedDecks({ slug, statuses: ONGOING }));
}

/**
 * Every ongoing tournament this player is in, checked at most once every 30
 * minutes per registration - run on each visit (see SiteHeader), so a player
 * who swaps decks mid-event is caught without waiting for a round to end.
 * Works across however many tournaments they are playing at once: each
 * registration carries its own baseline and its own throttle.
 */
export async function enforcePlayerDecks(playerId: string): Promise<number> {
  return enforce(
    await repo().listWatchedDecks({
      playerId,
      statuses: ONGOING,
      checkedBefore: new Date(Date.now() - DECK_CHECK_INTERVAL_MS),
    }),
  );
}
