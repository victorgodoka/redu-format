import { BANLIST_IDS } from "./banlist.ts";
import { CARD_LIB } from "./cardLib.ts";
import { stripRarity } from "./cards.ts";
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
    }
  | {
      /** Found in the card database, but never released to the TCG. */
      type: "not-tcg";
      cardId: number;
      cardName: string;
    }
  | {
      /** Ids no card database row could be found for, reported together as one line. */
      type: "unknown";
      cardIds: number[];
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
export const DEFAULT_COPIES = 3;

export { stripRarity } from "./cards.ts";

/**
 * A deck may never carry the plain passcode of a card that has an errata, nor
 * one of its alt-art aliases: this format plays the original wording, so the
 * errata id is the only accepted spelling. Every alternate id (alt-art alias
 * or pre-errata printing) still counts as the same card when copies are
 * tallied, and the banlist restricts all of them together.
 */

// ---------------------------------------------------------------------------
// Indexes, built once per process rather than rebuilt per deck.
// ---------------------------------------------------------------------------

/** Every id a deck may legally contain: passcodes, their alt-art aliases, and pre-errata printings. */
const POOL = new Set<number>();
const NAME_BY_ID = new Map<number, string>();
/** Alt-art alias or pre-errata printing id -> the passcode it counts as. */
const PASSCODE_BY_ALT = new Map<number, number>();
/** Passcode -> its alt-art alias ids, empty when the card has none. */
const ALIASES_BY_PASSCODE = new Map<number, number[]>();
/** Passcode -> pre-errata printing id, for the "use the other one" message. */
const PRINT_BY_PASSCODE = new Map<number, number>();

for (const card of CARD_LIB) {
  POOL.add(card.id);
  NAME_BY_ID.set(card.id, card.name);

  const aliases = card.aliases ?? [];
  ALIASES_BY_PASSCODE.set(card.id, aliases);
  for (const alias of aliases) {
    POOL.add(alias);
    NAME_BY_ID.set(alias, card.name);
    PASSCODE_BY_ALT.set(alias, card.id);
  }

  if (card.errataId !== null) {
    POOL.add(card.errataId);
    NAME_BY_ID.set(card.errataId, card.name);
    PASSCODE_BY_ALT.set(card.errataId, card.id);
    PRINT_BY_PASSCODE.set(card.id, card.errataId);
  }
}

const LIMIT_BY_PASSCODE = new Map<
  number,
  { copies: number; section: string }
>();

for (const section of BANLIST_IDS) {
  const copies = BAN_COPIES[section.slug];
  if (copies === undefined) continue;
  // Every printing in the group (canonical, alt-art alias or errata id)
  // shares the same restriction.
  for (const ids of section.cards) {
    for (const id of ids) {
      LIMIT_BY_PASSCODE.set(id, { copies, section: section.slug });
    }
  }
}

function nameOf(id: number): string {
  return NAME_BY_ID.get(id) ?? `Unknown card ${id}`;
}

/** Strips the rarity digits, then collapses an alt-art alias or pre-errata printing onto its passcode. */
function normalise(id: number): number {
  const printed = stripRarity(id);
  return PASSCODE_BY_ALT.get(printed) ?? printed;
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
    prints.add(stripRarity(id));
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

    // 3. Errata. Neither the passcode nor one of its alt-art aliases is
    //    acceptable: only the errata id carries the legal wording.
    const errataId = PRINT_BY_PASSCODE.get(passcode);
    if (errataId !== undefined) {
      const illegalIds = [passcode, ...(ALIASES_BY_PASSCODE.get(passcode) ?? [])];
      if (illegalIds.some((id) => prints.has(id))) {
        errors.push({
          type: "errata",
          cardId: passcode,
          cardName: nameOf(passcode),
          errataId,
        });
      }
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
    case "not-tcg":
      return `${error.cardName} is not legal in the TCG`;
    // Copy as specified by the tournament staff, in Portuguese.
    case "unknown":
      return `Esses IDs de carta não foram achadas: ${error.cardIds.join(", ")}. Edite seu deck e/ou verifique artes alternativas e avise a moderação`;
  }
}
