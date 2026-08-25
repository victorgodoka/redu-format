import { readFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_BANLIST, type Banlist } from "./events.ts";
import type { NexusDeckLists } from "./nexus-parse.ts";
import {
  DEFAULT_COPIES,
  stripRarity,
  validateDeck,
  type DeckValidationError,
  type DeckValidationResult,
  type ValidatedDeck,
} from "./validateDecks.ts";

/*
 * Server-side only, and kept that way by the node:fs read below rather than by
 * a `server-only` guard, so the validator stays runnable from a plain node test.
 */

/** Copies each TCG banlist status allows. Anything unlisted plays at the usual three. */
const BAN_COPIES: Record<string, number> = {
  forbidden: 0,
  limited: 1,
  "semi-limited": 2,
};

/** How far down from a written id to look for the real card - alt arts sit a few ids above the print. */
const ALT_ART_SEARCH = 5;

/**
 * An English print code: set prefix, the EN region tag, and a number
 * ("DUAD-EN056"). A card carrying one was printed for the TCG, which is the
 * evidence that arrives first - a set can be out for weeks before the dump's
 * `formats`/`tcg_date` catch up with it.
 */
const TCG_SET_CODE = /^[A-Z0-9]+-EN\d+$/i;

type TcgCard = { name: string; tcg: boolean; ban: string | null };

type RawCard = {
  id: number;
  name: string;
  banlist_info?: { ban_tcg?: string };
  card_images?: { id: number }[];
  card_sets?: { set_code?: string }[];
  misc_info?: { formats?: string[]; tcg_date?: string }[];
};

/**
 * lib/cardinfo.json is the source of truth for the modern game - 24MB of it,
 * so it is read once, on the first TCG deck anyone validates, and reduced to
 * the three fields that decide legality plus the alternate-art ids. A
 * REDU-only site never pays for it, and the parsed dump is dropped as soon as
 * the index is built.
 */
let index: { cards: Map<number, TcgCard>; altArt: Map<number, number> } | null = null;

function load(): NonNullable<typeof index> {
  if (index) return index;

  const file = path.join(process.cwd(), "lib", "cardinfo.json");
  const dump = JSON.parse(readFileSync(file, "utf8")) as { data: RawCard[] };

  const cards = new Map<number, TcgCard>();
  // Every printing's own id, from card_images - an alternate art is a
  // different id for the same card, and the only place it is written down.
  const altArt = new Map<number, number>();

  for (const card of dump.data) {
    const misc = card.misc_info?.[0];
    cards.set(card.id, {
      name: card.name,
      // Released to the TCG at all: the format list says so, there is a real
      // TCG release date on file, or it carries an English print code.
      tcg: Boolean(
        misc?.formats?.includes("TCG") ||
          isDate(misc?.tcg_date) ||
          card.card_sets?.some((set) => TCG_SET_CODE.test(set.set_code ?? "")),
      ),
      ban: card.banlist_info?.ban_tcg?.toLowerCase() ?? null,
    });
    for (const image of card.card_images ?? []) {
      if (image.id !== card.id) altArt.set(image.id, card.id);
    }
  }

  index = { cards, altArt };
  return index;
}

function isDate(value: string | undefined): boolean {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

/**
 * The card a written id means: the passcode itself, then the alternate-art id
 * the database has on file for it, and only then a walk back down a few ids -
 * the fallback for a printing card_images does not list, since Nexus hands
 * out alternate ids close to the passcode.
 */
function resolve(id: number): number | null {
  const { cards, altArt } = load();
  if (cards.has(id)) return id;

  const alt = altArt.get(id);
  if (alt !== undefined) return alt;

  for (let candidate = id - 1; candidate >= id - ALT_ART_SEARCH; candidate--) {
    if (cards.has(candidate)) return candidate;
  }
  return null;
}

export function validateTcgDeck(deck: NexusDeckLists): DeckValidationResult {
  const { cards: pool } = load();
  const errors: DeckValidationError[] = [];
  const unknown = new Set<number>();
  const copies = new Map<number, number>();

  for (const written of [...deck.main, ...deck.extra, ...deck.side]) {
    const printed = stripRarity(written);
    const id = resolve(printed);
    if (id === null) {
      unknown.add(printed);
      continue;
    }
    copies.set(id, (copies.get(id) ?? 0) + 1);
  }

  for (const [id, count] of copies) {
    const card = pool.get(id)!;

    if (!card.tcg) {
      errors.push({ type: "not-tcg", cardId: id, cardName: card.name });
      continue;
    }

    const allowed = card.ban ? (BAN_COPIES[card.ban] ?? DEFAULT_COPIES) : DEFAULT_COPIES;
    if (count > allowed) {
      errors.push({
        type: "banlist",
        cardId: id,
        cardName: card.name,
        section: card.ban ?? "unrestricted",
        allowedCopies: allowed,
        actualCopies: count,
      });
    }
  }

  if (unknown.size > 0) errors.push({ type: "unknown", cardIds: [...unknown] });

  return { valid: errors.length === 0, errors };
}

/** Checks a deck against whichever banlist the tournament runs. Player dashboards never come through here - they are always REDU. */
export function validateDeckFor(
  banlist: Banlist | undefined,
  deck: NexusDeckLists,
): DeckValidationResult {
  return (banlist ?? DEFAULT_BANLIST) === "tcg-2026-05" ? validateTcgDeck(deck) : validateDeck(deck);
}

export function validateDecksFor(
  banlist: Banlist | undefined,
  decks: readonly NexusDeckLists[],
): ValidatedDeck[] {
  return decks.map((deck) => ({ ...deck, ...validateDeckFor(banlist, deck) }));
}
