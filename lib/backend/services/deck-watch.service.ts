import { createHash } from "node:crypto";
import { describeDelta, diffDeckLists, parseSnapshot, type DeckCardDelta, type DeckSnapshot } from "../../deck-diff.ts";
import { fetchDeckArt } from "../../nexus-parse.ts";
import { getPool } from "../db/client.ts";
import { RegistrationsRepository, type WatchedDeck } from "../repositories/registrations.repository.ts";
import { notify } from "./notifications.service.ts";

export const DECK_MISMATCH = "deck.mismatch";

/** Tournaments whose decks are still meant to be frozen. Nothing to police once it's over. */
const LIVE_STATUSES = new Set(["scheduled", "running"]);

export type DeckMismatchMetadata = {
  deckId: string;
  deckName: string;
  tournament: WatchedDeck["tournament"];
  /** Present on the admin copy only - who changed their deck, with no credential of theirs attached. */
  player?: WatchedDeck["player"];
  /** Present on the admin copy only - the old-vs-new comparison. */
  changes?: DeckCardDelta[];
  /** Present on the player copy only - the deck exactly as they registered it. */
  registered?: DeckSnapshot;
};

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Order-insensitive, so Nexus reshuffling a list on open is not a new state. */
function deckState(deck: DeckSnapshot): string {
  return JSON.stringify({
    main: [...deck.main].sort((a, b) => a - b),
    extra: [...deck.extra].sort((a, b) => a - b),
    side: [...deck.side].sort((a, b) => a - b),
  });
}

function summarise(deltas: DeckCardDelta[]): string {
  const lines = deltas.slice(0, 12).map(describeDelta);
  if (deltas.length > lines.length) lines.push(`...and ${deltas.length - lines.length} more changes`);
  return lines.join("\n");
}

/**
 * Compares one registration's deck as it stands on Dueling Nexus against the
 * snapshot taken when it was registered, and raises the pair of alerts if they
 * differ. Reads the deck through its public UUID rather than the player's
 * token, so a sweep can run from a round-generation or a cron with no session
 * in hand.
 *
 * Returns false - not an alert - when Nexus can't be reached or the deck was
 * made private or deleted: those are not evidence of an edit, and firing on
 * them would turn every upstream blip into an accusation.
 */
export async function checkWatchedDeck(watched: WatchedDeck): Promise<boolean> {
  const registered = parseSnapshot(watched.deckSnapshot);
  if (!registered) return false;

  const live = await fetchDeckArt(watched.deckId);
  if (!live) return false;

  const current: DeckSnapshot = { main: live.main, extra: live.extra, side: live.side };
  const changes = diffDeckLists(registered, current);
  if (changes.length === 0) return false;

  const { player, tournament, deckId, deckName } = watched;
  // Includes the offending deck state, so a *further* edit raises a fresh alert
  // while a re-scan of the same one is swallowed by the unique index.
  const state = hash(`${deckId}|${deckState(current)}`);
  const base: DeckMismatchMetadata = { deckId, deckName, tournament };

  await notify({
    id: crypto.randomUUID(),
    audience: "admin",
    playerId: null,
    kind: DECK_MISMATCH,
    title: `Deck mismatch - ${player.name} in ${tournament.name}`,
    body:
      `${player.name} registered deck "${deckName}" (${deckId}) for ${tournament.name}, ` +
      `but Dueling Nexus now reports a different list. ${changes.length} change${changes.length === 1 ? "" : "s"}:\n` +
      summarise(changes),
    metadata: { ...base, player, changes },
    fingerprint: hash(`admin|${DECK_MISMATCH}|${tournament.slug}|${state}`),
  });

  await notify({
    id: crypto.randomUUID(),
    audience: "player",
    playerId: player.id,
    kind: DECK_MISMATCH,
    title: `Your deck for ${tournament.name} no longer matches your registration`,
    body:
      `The deck "${deckName}" (${deckId}) you registered for ${tournament.name} has changed on Dueling Nexus ` +
      `since you signed up. Decks are frozen once registered, so restore the list below before your next round ` +
      `and contact staff if you did not make this change.`,
    metadata: { ...base, registered },
    fingerprint: hash(`player|${player.id}|${DECK_MISMATCH}|${tournament.slug}|${state}`),
  });

  return true;
}

async function check(watched: WatchedDeck[]): Promise<number> {
  // ponytail: one upstream call per registration, all in flight at once - fine
  // at event sizes this site runs. Batch or queue it if a sweep ever spans
  // hundreds of decks at once.
  const results = await Promise.all(
    watched
      .filter((w) => LIVE_STATUSES.has(w.tournament.status))
      // One unreachable deck must not abort the rest of the sweep, and none of
      // this is worth failing a round generation over.
      .map((w) => checkWatchedDeck(w).catch(() => false)),
  );
  return results.filter(Boolean).length;
}

/** Every registered deck in one tournament: run at start, and at every new round. */
export async function sweepTournamentDecks(slug: string): Promise<number> {
  return check(await new RegistrationsRepository(getPool()).listWatchedDecks({ slug }));
}

/** Every live registration one player holds: run when they log in or resume a session. */
export async function sweepPlayerDecks(playerId: string): Promise<number> {
  return check(await new RegistrationsRepository(getPool()).listWatchedDecks({ playerId }));
}
