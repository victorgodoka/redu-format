const AVATAR_HOST = "duelingnexus.com";

export type NexusDeck = {
  id: string;
  name: string;
  main: number;
  extra: number;
  side: number;
  /** Card id for the cover art, "" when the main deck is empty. */
  coverId: string;
};

/**
 * Deck lists arrive as comma-joined card ids, and an empty list is "" rather
 * than an absent key. Splitting that naively yields [""] and counts as 1, so
 * the blanks are filtered before anything is measured.
 */
function cardIds(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((id) => id.trim())
    .filter((id) => /^\d+$/.test(id));
}

export function parseDeck(raw: unknown): NexusDeck | null {
  if (typeof raw !== "object" || raw === null) return null;
  const deck = raw as Record<string, unknown>;
  if (typeof deck.id !== "string" || deck.id.length === 0) return null;

  const main = cardIds(deck.main_deck);

  return {
    id: deck.id,
    name: typeof deck.name === "string" && deck.name ? deck.name : "Untitled",
    main: main.length,
    extra: cardIds(deck.extra_deck).length,
    side: cardIds(deck.side_deck).length,
    coverId: main[0] ?? "",
  };
}

/**
 * Nexus sends the avatar as an absolute URL. Anything that is not https on the
 * expected host is dropped, so a changed upstream response cannot make the site
 * render an image from somewhere else.
 */
export function cleanAvatar(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== AVATAR_HOST) return "";
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
