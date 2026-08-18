/** Nexus serves avatars from its own uploads, or from ygopro.online for default ones. */
const AVATAR_HOSTS = new Set(["duelingnexus.com", "ygopro.online"]);

export const NEXUS_DECK_INFO_URL = "https://duelingnexus.com/api/get-deck-info.php";

/** Nexus's own default avatar. Fallback whenever a profile's avatar 404s. */
export const DEFAULT_AVATAR = "https://ygopro.online/assets/profile/Avatars/0.jpg";

export type NexusDeck = {
  id: string;
  name: string;
  main: number;
  extra: number;
  side: number;
  /** Card id for the cover art, null when the main deck is empty. */
  coverId: number | null;
};

export type NexusDeckLists = {
  id: string;
  main: number[];
  extra: number[];
  side: number[];
};

/**
 * Deck lists arrive as comma-joined card ids, and an empty list is "" rather
 * than an absent key. Splitting that naively yields [""] and counts as 1, so
 * the blanks are filtered before anything is measured.
 */
export function cardIds(value: unknown): number[] {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((id) => id.trim())
    .filter((id) => /^\d+$/.test(id))
    .map((id) => Number(id))
}

/**
 * Standard construction limits: 40 to 60 in the main deck, at most 15 in the
 * extra and side. A deck outside these cannot be registered for an event.
 */
export function deckLegality(deck: NexusDeck): string | null {
  if (deck.main < 40) return `Main deck has ${deck.main} cards, needs 40`;
  if (deck.main > 60) return `Main deck has ${deck.main} cards, limit is 60`;
  if (deck.extra > 15) return `Extra deck has ${deck.extra} cards, limit is 15`;
  if (deck.side > 15) return `Side deck has ${deck.side} cards, limit is 15`;
  return null;
}

export function parseDeck(raw: unknown): NexusDeck | null {
  if (typeof raw !== "object" || raw === null) return null;
  const deck = raw as Record<string, unknown>;
  if (typeof deck.id !== "string" || deck.id.length === 0) return null;

  const main = cardIds(deck.main_deck);
  // `cover` is the 0-based index of the chosen cover card within main_deck,
  // not a card id: Nexus sends 0 by default, and 0 is not a valid passcode.
  const cover = typeof deck.cover === "number" ? deck.cover : 0;

  return {
    id: deck.id,
    name: typeof deck.name === "string" && deck.name ? deck.name : "Untitled",
    main: main.length,
    extra: cardIds(deck.extra_deck).length,
    side: cardIds(deck.side_deck).length,
    coverId: main[cover] ?? main[0] ?? null,
  };
}

export function parseDeckList(raw: unknown): NexusDeckLists | null {
  if (typeof raw !== "object" || raw === null) return null;
  const deck = raw as Record<string, unknown>;
  if (typeof deck.id !== "string" || deck.id.length === 0) return null;

  return {
    id: deck.id,
    main: cardIds(deck.main_deck),
    extra: cardIds(deck.extra_deck),
    side: cardIds(deck.side_deck),
  };
}

export type NexusDeckArt = {
  main: number[];
  extra: number[];
  side: number[];
  coverId: number | null;
};

/**
 * Live-fetches a public deck's full card lists and cover art by its Dueling
 * Nexus UUID - used for standings pages, where there's no session token to
 * read a signed-in player's own profile through. Returns null if the deck is
 * private, deleted, or Nexus is unreachable.
 */
export async function fetchDeckArt(uuid: string): Promise<NexusDeckArt | null> {
  let payload: unknown;
  try {
    const res = await fetch(`${NEXUS_DECK_INFO_URL}?uuid=${encodeURIComponent(uuid)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    payload = await res.json();
  } catch {
    return null;
  }

  if (typeof payload !== "object" || payload === null || (payload as { success?: unknown }).success !== true) {
    return null;
  }

  const deck = payload as Record<string, unknown>;
  const main = cardIds(deck.main_deck);
  // `cover` is the 0-based index of the chosen cover card within main_deck, same as parseDeck().
  const cover = typeof deck.cover === "number" ? deck.cover : 0;

  return {
    main,
    extra: cardIds(deck.extra_deck),
    side: cardIds(deck.side_deck),
    coverId: main[cover] ?? main[0] ?? null,
  };
}

/**
 * Nexus sends the avatar as an absolute URL. Anything that is not https on an
 * expected host is dropped, so a changed upstream response cannot make the
 * site render an image from somewhere else.
 */
export function cleanAvatar(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !AVATAR_HOSTS.has(url.hostname)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

/**
 * Nexus sends `contributor` as a stringified pair, e.g. "[false, 0]".
 *
 * [0] is whether the user contributes.
 * [1] is a time whose unit is still unconfirmed. A sample of 2623504337 reads
 * as either a unix-seconds expiry (2053-02-18) or a duration in milliseconds
 * (~30.4 days). Re-reading the same account a week apart tells them apart: a
 * duration grows by 604800000, an expiry does not move. Until that is settled
 * the number is carried through but never displayed.
 */
export function parseContributor(value: unknown): {
  contributor: boolean;
  contributorTime: number;
} {
  const none = { contributor: false, contributorTime: 0 };
  if (typeof value !== "string") return none;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return none;
    return {
      contributor: Boolean(parsed[0]),
      contributorTime: typeof parsed[1] === "number" ? parsed[1] : 0,
    };
  } catch {
    return none;
  }
}
