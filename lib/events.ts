/**
 * Mock tournament data. Replace `events` with a backend read; the filter and
 * paging helpers below take a list, so nothing else has to change.
 */

export type Structure = "swiss" | "single-elim" | "double-elim";

/** Which platform hosts the duels. Only one exists today; kept as a real field (not an assumption) so a second one can be added later without a schema change. */
export type Engine = "dueling-nexus";

export const ENGINES: Record<Engine, { label: string }> = {
  "dueling-nexus": { label: "Dueling Nexus" },
};

/**
 * Swiss can optionally cut to a bracket afterwards (TournamentEvent.topCut);
 * that used to be its own "mixed" structure, but a top cut is an attribute of
 * Swiss, not a different structure.
 */
export type EntryFee = { type: "free" } | { type: "paid"; amount: number; currency: string };

/**
 * Explicit lifecycle state - the source of truth for what a tournament is
 * doing right now. `scheduled` -> `running` -> `finished` is the normal path
 * (via startBracket()/completeBracket()); `cancelled` can happen from either
 * `scheduled` or `running`, but never from `finished` - a tournament with a
 * frozen official result can't retroactively un-happen.
 */
export type TournamentStatus = "scheduled" | "running" | "finished" | "cancelled";

export type TournamentEvent = {
  slug: string;
  name: string;
  /**
   * Optional rich-text blurb shown on the tournament page, parsed by
   * lib/rich-text.ts (never raw HTML) - supports **bold**, *italic*, and
   * blank lines as paragraph breaks. Optional so existing fixtures/rows
   * from before this field existed still satisfy the type.
   */
  description?: string | null;
  /** Whether a banner image is stored for this tournament - fetch the bytes from GET /events/[slug]/banner, never inlined here (keeps list queries light). */
  hasBanner: boolean;
  /** ISO instant. Rendered in UTC so server and client never disagree. */
  startsAt: string;
  structure: Structure;
  rounds: number;
  /** Size of the elimination bracket after Swiss, null when there is none. */
  topCut: number | null;
  status: TournamentStatus;
  /** ISO instant the bracket was actually started, or null if it hasn't been yet. Separate from startsAt - staff can start early, and this is what actually closes registration. */
  startedAt: string | null;
  /** ISO instant completeBracket() froze final placings, or null while the tournament is still upcoming or in progress. */
  finishedAt: string | null;
  /** ISO instant the tournament was cancelled, or null. */
  cancelledAt: string | null;
  matchFormat: "Bo1" | "Bo3";
  /**
   * How many days a round stays open before it's force-closed - not a per-duel
   * clock. Players coordinate and duel at their own pace within that window.
   */
  roundLimitDays: number;
  engine: Engine;
  /** null means uncapped registration. */
  seats: number | null;
  taken: number;
  entry: EntryFee;
  host: string;
  signupUrl: string;
};

/** The admin form's Seats dropdown; null (Unlimited) is handled separately. */
export const SEAT_OPTIONS = [8, 16, 32, 64, 128, 256, 512, 1024] as const;

export const STRUCTURES: Record<Structure, { label: string; short: string }> = {
  swiss: { label: "Swiss", short: "Swiss" },
  "single-elim": { label: "Single Elimination", short: "Single elim" },
  "double-elim": { label: "Double Elimination", short: "Double elim" },
};

export type FeaturedEvent = {
  slug: string;
  name: string;
  winner: string;
  community: string;
  players: number;
  format: string;
  winningDeck: string;
  /** Date-only ISO, so it reads the same regardless of viewer timezone. */
  date: string;
};

/**
 * Historical highlight, permanently pinned as the Hall of Fame - not a row in
 * the tournaments table, so it never gets bumped by whatever real tournament
 * finishes next.
 */
export const FEATURED_EVENT: FeaturedEvent = {
  slug: "ycs-providence-2012",
  name: "YCS Providence 2012",
  winner: "Chris LeBlanc",
  community: "Konami",
  players: 1154,
  format: "Wind-Up",
  winningDeck: "Karakuri Geargia",
  date: "2012-10-22",
};

export function formatEntry(entry: EntryFee): string {
  if (entry.type === "free") return "Free entry";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: entry.currency,
  }).format(entry.amount);
}

/**
 * The bracket size for a Swiss top cut, by field size. null means no cut is
 * warranted at that size. Also the source of truth the admin form's live
 * preview reads from, so the displayed suggestion and the persisted value
 * can never drift apart.
 */
export function recommendedTopCut(seats: number): number | null {
  if (seats <= 8) return null;
  if (seats <= 16) return 4;
  if (seats <= 128) return 8;
  if (seats <= 256) return 16;
  if (seats <= 512) return 32;
  return 64;
}

export const PAGE_SIZE = 8;

/** Fraction of seats claimed, 0 to 1. Uncapped events can never be "almost full". */
export function fillRatio(event: TournamentEvent): number {
  if (event.seats === null) return 0;
  if (event.seats <= 0) return 1;
  return Math.min(1, event.taken / event.seats);
}

/**
 * True once the event is no longer open for new signups - status is
 * anything but `scheduled` (staff started the bracket, possibly ahead of the
 * advertised time, or the tournament was cancelled), or the advertised time
 * has simply passed with nobody starting it yet. Despite the name, this
 * doesn't mean the tournament has *finished* - an event can be "past" for
 * hours or days while its rounds are still being played.
 */
export function isPast(event: TournamentEvent, now: Date): boolean {
  return event.status !== "scheduled" || new Date(event.startsAt).getTime() < now.getTime();
}

/**
 * True once completeBracket() has frozen final placings for this event - the
 * only correct signal for "Finished" labeling, a Results link, or showing
 * placement. isPast() alone is not enough: a tournament can be `isPast`
 * (registration closed) for days while still mid-bracket.
 */
export function isFinished(event: TournamentEvent): boolean {
  return event.status === "finished";
}

/** True once the tournament has been cancelled - no placings, doesn't count for ranking. */
export function isCancelled(event: TournamentEvent): boolean {
  return event.status === "cancelled";
}

/**
 * Combines a date input value, a time input value, and an IANA zone name into
 * the UTC instant the admin meant - `new Date(`${date}T${time}`)` alone
 * parses in whatever timezone the Node process happens to run in, which
 * silently disagrees with the admin's own wall-clock reading unless the two
 * happen to match. No timezone-database dependency needed: rendering the same
 * instant through the target zone and through UTC reveals the offset between
 * them, which is the standard trick for this without a library.
 */
export function zonedDateTimeToUtc(date: string, time: string, timeZone: string): Date | null {
  const naive = new Date(`${date}T${time}:00Z`);
  if (Number.isNaN(naive.getTime())) return null;

  try {
    const asZoned = new Date(naive.toLocaleString("en-US", { timeZone }));
    const asUtc = new Date(naive.toLocaleString("en-US", { timeZone: "UTC" }));
    const offsetMs = asUtc.getTime() - asZoned.getTime();
    return new Date(naive.getTime() + offsetMs);
  } catch {
    return null;
  }
}

/** 80% is the point where a room reads as "about to sell out". */
export const ALMOST_FULL = 0.8;

export type EventQuery = {
  structure?: string;
  when?: string;
  seats?: string;
  page?: string;
};

export type EventResults = {
  items: TournamentEvent[];
  page: number;
  pages: number;
  total: number;
};

export function seatsLeft(event: TournamentEvent): number {
  if (event.seats === null) return Infinity;
  return Math.max(0, event.seats - event.taken);
}

/**
 * Filters and pages the list. Unknown or out-of-range query values fall back to
 * the widest sensible option rather than returning nothing, so a hand-edited or
 * stale URL still renders a usable page.
 */
export function queryEvents(
  all: readonly TournamentEvent[],
  query: EventQuery,
  now: Date = new Date(),
): EventResults {
  let items = all.filter((event) => {
    if (query.structure && query.structure !== "all") {
      if (event.structure !== query.structure) return false;
    }

    const started = isPast(event, now);
    if (query.when === "upcoming" && started) return false;
    if (query.when === "past" && !started) return false;

    const left = seatsLeft(event);
    if (query.seats === "open" && left === 0) return false;
    if (query.seats === "full" && left > 0) return false;
    // "almost" means nearly sold out but still joinable, so full is excluded.
    if (query.seats === "almost" && (left === 0 || fillRatio(event) < ALMOST_FULL)) {
      return false;
    }

    return true;
  });

  // Upcoming reads soonest first; past reads most recent first.
  items = items.sort((a, b) => {
    const diff =
      new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
    return query.when === "past" ? -diff : diff;
  });

  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const asked = Number.parseInt(query.page ?? "1", 10);
  const page = Number.isFinite(asked) ? Math.min(Math.max(asked, 1), pages) : 1;

  const start = (page - 1) * PAGE_SIZE;

  return { items: items.slice(start, start + PAGE_SIZE), page, pages, total };
}

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

export function formatDate(iso: string) {
  return dateFormat.format(new Date(iso));
}

export function formatTime(iso: string) {
  return `${timeFormat.format(new Date(iso))} UTC`;
}
