import { BANLIST_IDS } from "./banlist.ts";
import { CARD_LIB } from "./cardLib.ts";
import { ERRATAS } from "./erratas.ts";
import type { NexusDeckLists } from "./nexus-parse.ts";

export type DeckValidationError =
  | {
      type: "banlist";
      cardId: number;
      cardName: string;
      section: string;
      allowedCopies: number;
      actualCopies: number;
    }
  | {
      type: "errata";
      cardId: number;
      cardName: string;
      errataId: number;
    }
  | {
      type: "format";
      cardId: number;
      cardName: string;
      copies: number;
    };

export type DeckValidationResult = {
  valid: boolean;
  errors: DeckValidationError[];
};

export type ValidatedDeck = NexusDeckLists & DeckValidationResult;

/** Copies allowed per banlist tier, keyed by slug, which is what sections carry. */
const BAN_COPIES: Record<string, number> = {
  forbidden: 0,
  limited: 1,
  "semi-limited": 2,
  unrestricted: 3,
};

/** The game's own ceiling for anything the banlist does not mention. */
const DEFAULT_COPIES = 3;

/**
 * A deck may never carry the passcode of a card that has an errata: this format
 * plays the original wording, so the errata id is the only accepted spelling.
 * Both ids still count as the same card when copies are tallied.
 */

// ---------------------------------------------------------------------------
// Indexes, built once per process rather than rebuilt per deck.
// ---------------------------------------------------------------------------

/** Every id a deck may legally contain: passcodes plus pre-errata printings. */
const POOL = new Set<number>();
const NAME_BY_ID = new Map<number, string>();
/** Pre-errata printing id -> passcode, so both spellings count as one card. */
const PASSCODE_BY_PRINT = new Map<number, number>();
/** Passcode -> pre-errata printing id, for the "use the other one" message. */
const PRINT_BY_PASSCODE = new Map<number, number>();

for (const card of CARD_LIB) {
  POOL.add(card.id);
  NAME_BY_ID.set(card.id, card.name);
}

for (const errata of ERRATAS) {
  POOL.add(errata.id);
  POOL.add(errata.errataId);
  NAME_BY_ID.set(errata.id, errata.name);
  NAME_BY_ID.set(errata.errataId, errata.name);
  PASSCODE_BY_PRINT.set(errata.errataId, errata.id);
  PRINT_BY_PASSCODE.set(errata.id, errata.errataId);
}

const LIMIT_BY_PASSCODE = new Map<
  number,
  { copies: number; section: string }
>();

for (const section of BANLIST_IDS) {
  const copies = BAN_COPIES[section.slug];
  if (copies === undefined) continue;
  for (const [id] of section.cards) {
    LIMIT_BY_PASSCODE.set(id, { copies, section: section.slug });
  }
}

function nameOf(id: number): string {
  return NAME_BY_ID.get(id) ?? `Unknown card ${id}`;
}

/** Collapses a pre-errata printing onto its passcode. */
function normalise(id: number): number {
  return PASSCODE_BY_PRINT.get(id) ?? id;
}

export function validateDeck(deck: NexusDeckLists): DeckValidationResult {
  const errors: DeckValidationError[] = [];
  const allCards = [...deck.main, ...deck.extra, ...deck.side];

  // Count by passcode, so a card cannot dodge its limit by mixing printings.
  const copiesByPasscode = new Map<number, number>();
  // Track which ids were actually written, to report the right one back.
  const printsSeen = new Map<number, Set<number>>();

  for (const id of allCards) {
    const passcode = normalise(id);
    copiesByPasscode.set(passcode, (copiesByPasscode.get(passcode) ?? 0) + 1);

    const prints = printsSeen.get(passcode) ?? new Set<number>();
    prints.add(id);
    printsSeen.set(passcode, prints);
  }

  for (const [passcode, copies] of copiesByPasscode) {
    const prints = printsSeen.get(passcode) ?? new Set<number>();

    // 1. Card pool. A card that cannot be played at all makes the other checks
    //    noise, so report it and move on.
    const outOfPool = [...prints].filter((id) => !POOL.has(id));
    if (outOfPool.length > 0) {
      for (const id of outOfPool) {
        errors.push({ type: "format", cardId: id, cardName: nameOf(id), copies });
      }
      continue;
    }

    // 2. Banlist, including the plain three-copy ceiling.
    const limit = LIMIT_BY_PASSCODE.get(passcode);
    const allowedCopies = limit?.copies ?? DEFAULT_COPIES;

    if (copies > allowedCopies) {
      errors.push({
        type: "banlist",
        cardId: passcode,
        cardName: nameOf(passcode),
        section: limit?.section ?? "unrestricted",
        allowedCopies,
        actualCopies: copies,
      });
    }

    // 3. Errata. The passcode of an errata'd card is never acceptable.
    const errataId = PRINT_BY_PASSCODE.get(passcode);
    if (errataId !== undefined && prints.has(passcode)) {
      errors.push({
        type: "errata",
        cardId: passcode,
        cardName: nameOf(passcode),
        errataId,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateDecks(
  decks: readonly NexusDeckLists[],
): ValidatedDeck[] {
  return decks.map((deck) => ({ ...deck, ...validateDeck(deck) }));
}

/** One short line per problem, ready to show to a player. */
export function describeError(error: DeckValidationError): string {
  switch (error.type) {
    case "format":
      return `${error.cardName} is not in the REDU card pool`;
    case "banlist":
      return error.allowedCopies === 0
        ? `${error.cardName} is Forbidden, deck has ${error.actualCopies}`
        : `${error.cardName} is limited to ${error.allowedCopies}, deck has ${error.actualCopies}`;
    case "errata":
      return `${error.cardName} has an errata: use card ${error.errataId}, not ${error.cardId}`;
  }
}
