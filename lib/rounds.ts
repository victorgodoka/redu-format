import type { DurationMode } from "./events.ts";

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export type RoundTimingConfig = {
  durationMode: DurationMode;
  /** Same-day round timer. */
  roundMinutes: number;
  /** Same-day moderator grace period after a round locks. */
  cleanupMinutes: number;
  /** Long-duration report window. */
  roundLimitDays: number;
};

export type RoundClock = {
  durationMode: DurationMode;
  /** ISO instant the current round's timer expires, or null when no round is open. */
  deadlineAt: string | null;
  /** Reporting is closed for this round. */
  locked: boolean;
  /**
   * ISO instant the next round starts on its own (same-day only, and only
   * once the current round is over). null in long-duration mode, which never
   * advances without a moderator.
   */
  nextRoundAt: string | null;
  /** Locked and waiting on a moderator to generate the next round. */
  awaitingModerator: boolean;
};

/**
 * How long a round stays open, by mode: a fixed timer in minutes for the
 * standard same-day tournament, the multi-day report window for a
 * long-duration one. This is the only place the two modes differ in clock
 * terms - everything downstream just uses the resulting deadline.
 */
export function roundCutoffMs(config: RoundTimingConfig): number {
  return config.durationMode === "long"
    ? config.roundLimitDays * DAY_MS
    : config.roundMinutes * MINUTE_MS;
}

/**
 * The state of the round in progress, derived purely from the persisted
 * round deadline - never from a client-side timer, so a refresh, a closed
 * tab, or a hand-edited page can't move it.
 *
 * A round is locked once its deadline passes, or once every match in it has
 * a result (nothing left to report either way). In same-day mode the next
 * round then starts by itself `cleanupMinutes` after the lock, unless a
 * moderator starts it earlier; in long-duration mode it never starts by
 * itself at all.
 */
export function roundClock(
  config: RoundTimingConfig,
  input: { deadlineAt: Date | null; allMatchesResolved: boolean; now: Date },
): RoundClock {
  const { deadlineAt, allMatchesResolved, now } = input;
  const expired = deadlineAt !== null && now.getTime() >= deadlineAt.getTime();
  const locked = expired || allMatchesResolved;
  const sameDay = config.durationMode !== "long";

  return {
    durationMode: config.durationMode,
    deadlineAt: deadlineAt?.toISOString() ?? null,
    locked,
    nextRoundAt:
      sameDay && deadlineAt
        ? new Date(deadlineAt.getTime() + config.cleanupMinutes * MINUTE_MS).toISOString()
        : null,
    awaitingModerator: locked && !sameDay,
  };
}

/** True once the cleanup window is over and a same-day tournament should pair the next round itself. */
export function shouldAutoAdvance(clock: RoundClock, now: Date): boolean {
  if (clock.durationMode === "long" || !clock.nextRoundAt) return false;
  return now.getTime() >= new Date(clock.nextRoundAt).getTime();
}
