import { CARD_LIB } from "./cardLib.ts";
import type { CardJson } from "./card-text.ts";

/**
 * An errata'd passcode appears twice in CARD_LIB: once with its current text
 * and null errata fields, then again with errataId/errataText set. A Map set
 * in iteration order makes the second (errata'd) row win, which is exactly
 * the "errata wins" precedence the old two-source merge used to need.
 * Built once per process; O(1) lookups after, instead of scanning ~5700 rows.
 */
const BY_ID = new Map<number, (typeof CARD_LIB)[number]>();
for (const card of CARD_LIB) BY_ID.set(card.id, card);
// Alt-art aliases and errata ids resolve to their owning row, but never
// shadow a real passcode already claimed above.
for (const card of CARD_LIB) {
  for (const alias of card.aliases) {
    if (!BY_ID.has(alias)) BY_ID.set(alias, card);
  }
  if (card.errataId !== null && !BY_ID.has(card.errataId)) {
    BY_ID.set(card.errataId, card);
  }
}
const byId = (id: number) => BY_ID.get(id);

/**
 * Dueling Nexus encodes a card's rarity in the high digits of the id
 * (passcode + rarity * 10^11), so the printed passcode is what is left over.
 * Every real passcode is far below the modulus, so this is a no-op for them.
 * Ids are stripped both before they are validated and before a deck snapshot
 * is stored, so a player swapping a card's rarity never reads as a deck edit.
 */
const RARITY_MODULUS = 100_000_000_000;

export function stripRarity(id: number): number {
  return id % RARITY_MODULUS;
}

/** Card page on the rulings database, keyed by Konami id, not by passcode. */
const RULINGS = "https://db.ygoresources.com/card#";
/** Only reached if a card has no koid on file. */
const RULINGS_SEARCH = "https://db.ygoresources.com/search#quick:";

export class Card {
  /** Passcode printed on the card. */
  readonly id: number;
  readonly name: string;
  /**
   * Pre-errata text when the card has an errata, current text otherwise. This
   * format is frozen before those errata, so the original wording is what
   * players are actually reading off the card.
   */
  readonly desc: string;
  /**
   * Internal id for the errata'd printing, null when the card never changed.
   * Not a passcode: it exists to tell the two versions apart.
   */
  readonly errataId: number | null;
  /** Konami id, used for rulings links. Not the passcode. */
  readonly koid: number | null;
  /** False when the id is not in the card library. */
  readonly found: boolean;

  constructor(cId: number) {
    const card = byId(cId);

    this.id = card?.id ?? cId;
    this.found = card !== undefined;
    this.name = card?.name ?? `Unknown card ${cId}`;
    // errataText is the pre-errata wording, which is what this frozen format
    // actually reads off the card; desc is always the current, post-errata text.
    this.desc = card?.errataText ?? card?.desc ?? "";
    this.errataId = card?.errataId ?? null;
    this.koid = card?.koid ?? null;
  }

  get hasErrata(): boolean {
    return this.errataId !== null;
  }

  /**
   * Id of the scan to show. For errata'd cards that is the pre-errata printing,
   * whose text matches `desc`; the passcode's own scan carries the newer text.
   */
  get printId(): number {
    return this.errataId ?? this.id;
  }

  get rulingsUrl(): string {
    if (this.koid !== null) return RULINGS + this.koid;
    return RULINGS_SEARCH + encodeURIComponent(this.name.toLowerCase());
  }

  /** Plain object for crossing the server/client boundary. */
  toJSON(): CardJson {
    return {
      id: this.id,
      name: this.name,
      desc: this.desc,
      printId: this.printId,
      errataId: this.errataId,
      koid: this.koid,
      rulingsUrl: this.rulingsUrl,
    };
  }
}

/** Looks up many ids at once, dropping any neither source knows. */
export function cardsByIds(ids: readonly number[]): Card[] {
  return ids.map((id) => new Card(id)).filter((card) => card.found);
}

export function findCardByName(name: string): Card | null {
  const wanted = name.trim().toLowerCase();
  const match = CARD_LIB.find((c) => c.name.toLowerCase() === wanted);
  return match ? new Card(match.id) : null;
}


export { parseCardText, type CardJson, type TextRun } from "./card-text.ts";
