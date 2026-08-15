/**
 * Port of the Dueling Nexus room-hash algorithm (provided by the DN team as
 * client-side JS): room settings are bit-packed into two 32-bit integers -
 * "basic" (visibility/mode/master rule/randomness) and "custom" (banlist,
 * format, time limit, life points, hand size, etc) - each base36-encoded to
 * a fixed 6 characters and concatenated. There's no need to decode a hash
 * back here, so only the encode half of the original is ported.
 */

const BASE36_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

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

function serializeBasic(randomness: number): number {
  // isPrivate=0, isMatch=1, isTag=0, masterRule=2, isCustom=1, isManual=0.
  let data = 0;
  data += 1 << 1; // isMatch
  data += 2 << 3; // masterRule 2 (Master Rules 2, 2011)
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

function serializeCustom(): number {
  // banlist=10 (2012.10 REDU/Wind-Up), format=1 (TCG), timeLimit=240s,
  // autoSkipTurn=false, startingLife=8000, startingHand=5, cardsPerDraw=1,
  // allowInvalidDecks=false, doNotShuffleTheDeck=false.
  let data = 0;
  data += 10 << 0;
  data += 1 << 5;
  data += (240 / 30 - 1) << 8;
  data += serializeStartingLife(8000) << 17;
  data += 5 << 20;
  data += 1 << 24;
  return data;
}

/**
 * A fresh room hash for a Dueling Nexus duel link
 * (`https://duelingnexus.com/duel/NA-{hash}`), fixed to REDU's standard
 * ruleset. Every call returns a different hash (a random ~23-bit component
 * keeps room names from colliding), so call it once per match and persist
 * the result rather than regenerating it.
 */
export function generateNexusRoomHash(): string {
  const randomness = Math.floor(Math.random() * 0x800000);
  return encodeBase36(serializeBasic(randomness)) + encodeBase36(serializeCustom());
}
