import { CARD_LIB } from "./cardLib.ts";
import { ERRATAS } from "./erratas.ts";
import type { CardJson } from "./card-text.ts";

/**
 * CARD_LIB holds 5145 entries and ERRATAS 113. Scanning both with `find` on
 * every lookup made a 151-card page do roughly 800k comparisons; these indexes
 * are built once per process and turn each lookup into a hash hit.
 */
const byId = new Map(CARD_LIB.map((c) => [c.id, c]));
const errataById = new Map(ERRATAS.map((e) => [e.id, e]));

/** Card page on the rulings database, keyed by Konami id, not by passcode. */
const RULINGS = "https://db.ygoresources.com/card#";
/** Only reached if a card is missing a koid in both sources. */
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
  /** False when neither source knows the id. */
  readonly found: boolean;

  constructor(id: number) {
    // The errata table is the source of truth; the library fills in the rest.
    const errata = errataById.get(id);
    const card = byId.get(id);

    this.id = id;
    this.found = errata !== undefined || card !== undefined;
    this.name = errata?.name ?? card?.name ?? `Unknown card ${id}`;
    this.desc = errata?.desc ?? card?.desc ?? "";
    this.errataId = errata?.errataId ?? null;
    this.koid = errata?.koid ?? card?.koid ?? null;
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
  const errata = ERRATAS.find((e) => e.name.toLowerCase() === wanted);
  if (errata) return new Card(errata.id);

  const match = CARD_LIB.find((c) => c.name.toLowerCase() === wanted);
  return match ? new Card(match.id) : null;
}


export { parseCardText, type CardJson, type TextRun } from "./card-text.ts";
