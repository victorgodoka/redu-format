import { Card, stripRarity } from "./cards.ts";
import type { NexusDeckLists } from "./nexus-parse.ts";

/** The three lists a deck is made of, without the Nexus id wrapper. */
export type DeckSnapshot = {
  main: number[];
  extra: number[];
  side: number[];
};

export type DeckSection = keyof DeckSnapshot;

export type DeckCardDelta = {
  section: DeckSection;
  cardId: number;
  cardName: string;
  /** Copies in the registered deck. */
  before: number;
  /** Copies in the deck Nexus reports now. */
  after: number;
};

const SECTIONS: DeckSection[] = ["main", "extra", "side"];

/**
 * The three lists, with rarity stripped off every id. A snapshot is only ever
 * compared against another snapshot, so both sides have to speak passcodes:
 * otherwise re-buying the same card in a different rarity would read as a deck
 * edit and disqualify the player mid-tournament.
 */
export function toSnapshot(deck: NexusDeckLists | DeckSnapshot): DeckSnapshot {
  return {
    main: deck.main.map(stripRarity),
    extra: deck.extra.map(stripRarity),
    side: deck.side.map(stripRarity),
  };
}

function countById(ids: readonly number[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

/**
 * Per-section, per-card copy counts of what changed between the deck as
 * registered and the deck as it stands on Dueling Nexus now. Order within a
 * section is not a change: Nexus reorders lists on its own when a deck is
 * merely opened, and re-alerting on that would bury the real edits.
 */
export function diffDeckLists(before: DeckSnapshot, after: DeckSnapshot): DeckCardDelta[] {
  const deltas: DeckCardDelta[] = [];

  for (const section of SECTIONS) {
    const from = countById(before[section]);
    const to = countById(after[section]);

    for (const cardId of new Set([...from.keys(), ...to.keys()])) {
      const was = from.get(cardId) ?? 0;
      const now = to.get(cardId) ?? 0;
      if (was === now) continue;
      deltas.push({ section, cardId, cardName: new Card(cardId).name, before: was, after: now });
    }
  }

  // Removals first, then additions, each alphabetical - reads as "what left,
  // what arrived" rather than as passcode order, which means nothing to a human.
  return deltas.sort((a, b) => {
    const rank = (d: DeckCardDelta) => (d.after === 0 ? 0 : d.before === 0 ? 2 : 1);
    return rank(a) - rank(b) || a.cardName.localeCompare(b.cardName);
  });
}

export function decksDiffer(before: DeckSnapshot, after: DeckSnapshot): boolean {
  return diffDeckLists(before, after).length > 0;
}

/** One short line per change, for the alert body and for plain-text contexts. */
export function describeDelta(delta: DeckCardDelta): string {
  const where = delta.section === "main" ? "Main" : delta.section === "extra" ? "Extra" : "Side";
  if (delta.before === 0) return `${where}: +${delta.after} ${delta.cardName} (${delta.cardId})`;
  if (delta.after === 0) return `${where}: -${delta.before} ${delta.cardName} (${delta.cardId})`;
  return `${where}: ${delta.cardName} (${delta.cardId}) ${delta.before} -> ${delta.after}`;
}

/** Accepts whatever came back out of the deck_snapshot JSON column. */
export function parseSnapshot(raw: unknown): DeckSnapshot | null {
  const value = typeof raw === "string" ? safeJson(raw) : raw;
  if (typeof value !== "object" || value === null) return null;

  const deck = value as Record<string, unknown>;
  const lists = SECTIONS.map((section) =>
    Array.isArray(deck[section]) ? (deck[section] as unknown[]).filter((id): id is number => typeof id === "number") : null,
  );
  if (lists.some((list) => list === null)) return null;

  // Stripped on the way out too: rows written before ids were normalised are
  // still in the table, and they have to compare against a fresh snapshot.
  return toSnapshot({ main: lists[0]!, extra: lists[1]!, side: lists[2]! });
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
