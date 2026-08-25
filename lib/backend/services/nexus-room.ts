/**
 * Port of the Dueling Nexus room-hash algorithm (provided by the DN team as
 * client-side JS): room settings are bit-packed into two 32-bit integers -
 * "basic" (visibility/mode/master rule/randomness) and "custom" (banlist,
 * format, time limit, life points, hand size, etc) - each base36-encoded to
 * a fixed 6 characters and concatenated. There's no need to decode a hash
 * back here, so only the encode half of the original is ported.
 */

import { DEFAULT_BANLIST, type Banlist } from "../../events.ts";

const BASE36_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * What each of our banlists means to Dueling Nexus: its Master Rule, and its
 * position in DN's own banlist list (`/assets/data/banlists.json`, which the
 * client fetches and indexes into - the packed value is that index, not a
 * stable id). Index 0 is "2026.05 TCG" and index 10 is "2012.10 REDU/Wind-Up"
 * as of this writing.
 *
 * ponytail: hardcoded indices. If DN ever inserts a list ahead of one of
 * these, rooms silently open on the wrong banlist - the fix is to fetch that
 * JSON and resolve by name, cached, rather than to renumber by hand.
 */
const NEXUS_RULESET: Record<Banlist, { banlist: number; masterRule: number }> = {
  "redu-2012-10": { banlist: 10, masterRule: 2 },
  "tcg-2026-05": { banlist: 0, masterRule: 5 },
};

function encodeBase36(input: number): string {
  let result = "";
  let n = input;
  do {
    result = BASE36_CHARS[n % 36] + result;
    n = Math.floor(n / 36);
  } while (n !== 0);
  while (result.length < 6) result = `0${result}`;
  return result;
}

function serializeBasic(masterRule: number, randomness: number): number {
  // isPrivate=0, isMatch=1, isTag=0, masterRule (3 bits), isCustom=1, isManual=0.
  let data = 0;
  data += 1 << 1; // isMatch
  data += masterRule << 3;
  data += 1 << 6; // isCustom
  data += randomness << 8;
  return data;
}

function serializeStartingLife(life: number): number {
  if (life === 50) return 0;
  for (let i = 0; i <= 0b111; i++) {
    if (life === 1000 * (1 << (i - 1))) return i;
  }
  return 0;
}

function serializeCustom(banlist: number): number {
  // banlist (5 bits, see NEXUS_RULESET), format=1 (TCG), timeLimit=240s,
  // autoSkipTurn=false, startingLife=8000, startingHand=5, cardsPerDraw=1,
  // allowInvalidDecks=false, doNotShuffleTheDeck=false.
  let data = 0;
  data += banlist << 0;
  data += 1 << 5;
  data += (240 / 30 - 1) << 8;
  data += serializeStartingLife(8000) << 17;
  data += 5 << 20;
  data += 1 << 24;
  return data;
}

/**
 * A fresh room hash for a Dueling Nexus duel link
 * (`https://duelingnexus.com/duel/NA-{hash}`), on the banlist and Master Rule
 * the tournament runs - a TCG event must not open REDU lobbies. Every call
 * returns a different hash (a random ~23-bit component keeps room names from
 * colliding), so call it once per match and persist the result rather than
 * regenerating it.
 */
export function generateNexusRoomHash(banlist: Banlist = DEFAULT_BANLIST): string {
  const ruleset = NEXUS_RULESET[banlist] ?? NEXUS_RULESET[DEFAULT_BANLIST];
  const randomness = Math.floor(Math.random() * 0x800000);
  return (
    encodeBase36(serializeBasic(ruleset.masterRule, randomness)) +
    encodeBase36(serializeCustom(ruleset.banlist))
  );
}
