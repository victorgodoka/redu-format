/**
 * Redeemable prize codes: which slice of the final standings each tier covers,
 * and who ends up with which code once the tournament is over.
 *
 * A tier runs from the place after the next-smaller tier down to its own name,
 * so Top 16 means 9th-16th, Top 8 means 5th-8th, and so on. Participation is
 * not a placement at all - it is the fallback everyone still standing gets.
 */

export type PrizeTier =
  | "winner"
  | "runner_up"
  | "top_4"
  | "top_8"
  | "top_16"
  | "top_32"
  | "participation";

export const PRIZE_TIERS: Record<PrizeTier, { label: string; from: number; to: number }> = {
  winner: { label: "Winner", from: 1, to: 1 },
  runner_up: { label: "Runner-up", from: 2, to: 2 },
  top_4: { label: "Top 4", from: 3, to: 4 },
  top_8: { label: "Top 8", from: 5, to: 8 },
  top_16: { label: "Top 16", from: 9, to: 16 },
  top_32: { label: "Top 32", from: 17, to: 32 },
  participation: { label: "Participation", from: 1, to: Number.POSITIVE_INFINITY },
};

/** Tier order as the admin form and the prize list show them. */
export const PRIZE_TIER_ORDER = Object.keys(PRIZE_TIERS) as PrizeTier[];

/** The placement tiers only - participation is never matched by place. */
const PLACEMENTS = PRIZE_TIER_ORDER.filter((t) => t !== "participation");

export function isPrizeTier(value: string): value is PrizeTier {
  return value in PRIZE_TIERS;
}

/** The placement tier a finishing place belongs to, or null past 32nd. */
export function tierForPlace(place: number): PrizeTier | null {
  return PLACEMENTS.find((t) => place >= PRIZE_TIERS[t].from && place <= PRIZE_TIERS[t].to) ?? null;
}

export type Finisher = { registrationId: string; place: number };
export type Prize = { id: string; tier: PrizeTier; code: string };
export type PrizeAssignment = { prizeId: string; registrationId: string };

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * One code per finisher, best place first: the code for their own placement
 * tier if one is still unclaimed, otherwise a participation code. A placement
 * code never leaks to a place outside its tier, and a finisher the codes run
 * out for simply gets nothing (as does every leftover code nobody was eligible
 * for). `finishers` must already exclude drops and disqualifications.
 *
 * Participation codes are dealt at random rather than in placing order - they
 * are interchangeable, and handing the first one to the winner every time is
 * the kind of pattern people read meaning into. `shuffle` is the test seam.
 */
export function assignPrizes(
  finishers: Finisher[],
  prizes: Prize[],
  shuffle: <T>(items: T[]) => T[] = shuffled,
): PrizeAssignment[] {
  const pools = new Map<PrizeTier, Prize[]>();
  for (const prize of prizes) {
    const pool = pools.get(prize.tier);
    if (pool) pool.push(prize);
    else pools.set(prize.tier, [prize]);
  }

  const participation = shuffle(pools.get("participation") ?? []);
  const assignments: PrizeAssignment[] = [];

  for (const finisher of [...finishers].sort((a, b) => a.place - b.place)) {
    const tier = tierForPlace(finisher.place);
    const prize = (tier ? pools.get(tier)?.shift() : undefined) ?? participation.shift();
    if (prize) assignments.push({ prizeId: prize.id, registrationId: finisher.registrationId });
  }

  return assignments;
}
