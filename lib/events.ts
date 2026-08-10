/**
 * Mock tournament data. Replace `events` with a backend read; the filter and
 * paging helpers below take a list, so nothing else has to change.
 */

export type Structure = "swiss" | "single-elim" | "mixed";

export type TournamentEvent = {
  slug: string;
  name: string;
  /** ISO instant. Rendered in UTC so server and client never disagree. */
  startsAt: string;
  structure: Structure;
  rounds: number;
  /** Size of the elimination bracket after Swiss, null when there is none. */
  topCut: number | null;
  matchFormat: "Bo1" | "Bo3";
  /** Round timer in minutes, before the end-of-match procedure. */
  timeLimit: number;
  seats: number;
  taken: number;
  entry: string;
  host: string;
  signupUrl: string;
};

export const STRUCTURES: Record<Structure, { label: string; short: string }> = {
  swiss: { label: "Swiss", short: "Swiss" },
  "single-elim": { label: "Single Elimination", short: "Single elim" },
  mixed: { label: "Swiss + Top Cut", short: "Swiss + cut" },
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

/** Historical highlight, pinned as the first card on the events page. */
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

export const events: readonly TournamentEvent[] = [
  {
    slug: "redu-weekly-52",
    name: "REDU Weekly #52",
    startsAt: "2026-08-12T23:00:00Z",
    structure: "swiss",
    rounds: 5,
    topCut: null,
    matchFormat: "Bo3",
    timeLimit: 40,
    seats: 64,
    taken: 41,
    entry: "Free entry",
    host: "Dueling Nexus",
    signupUrl: "#",
  },
  {
    slug: "wind-up-cup-xi",
    name: "Wind-Up Cup XI",
    startsAt: "2026-08-15T18:00:00Z",
    structure: "mixed",
    rounds: 6,
    topCut: 8,
    matchFormat: "Bo3",
    timeLimit: 40,
    seats: 128,
    taken: 128,
    entry: "Free · Playmat for Top 4",
    host: "REDU Format Discord",
    signupUrl: "#",
  },
  {
    slug: "gear-gigant-open",
    name: "Gear Gigant Open",
    startsAt: "2026-08-16T21:30:00Z",
    structure: "single-elim",
    rounds: 5,
    topCut: null,
    matchFormat: "Bo3",
    timeLimit: 45,
    seats: 32,
    taken: 19,
    entry: "Free entry",
    host: "Dueling Nexus",
    signupUrl: "#",
  },
  {
    slug: "providence-memorial-2026",
    name: "Providence Memorial 2026",
    startsAt: "2026-10-20T17:00:00Z",
    structure: "mixed",
    rounds: 8,
    topCut: 8,
    matchFormat: "Bo3",
    timeLimit: 45,
    seats: 256,
    taken: 173,
    entry: "Free · Prize support",
    host: "REDU Format Discord",
    signupUrl: "#",
  },
  {
    slug: "zexal-series-stage-3",
    name: "Zexal Series: Stage 3",
    startsAt: "2026-08-22T19:00:00Z",
    structure: "swiss",
    rounds: 6,
    topCut: null,
    matchFormat: "Bo3",
    timeLimit: 40,
    seats: 96,
    taken: 58,
    entry: "Free · Series points",
    host: "Dueling Nexus",
    signupUrl: "#",
  },
  {
    slug: "chaos-dragon-invitational",
    name: "Chaos Dragon Invitational",
    startsAt: "2026-08-23T22:00:00Z",
    structure: "single-elim",
    rounds: 4,
    topCut: null,
    matchFormat: "Bo3",
    timeLimit: 45,
    seats: 16,
    taken: 16,
    entry: "Invite only",
    host: "REDU Format Discord",
    signupUrl: "#",
  },
  {
    slug: "madolche-marathon",
    name: "Madolche Marathon",
    startsAt: "2026-08-29T18:30:00Z",
    structure: "swiss",
    rounds: 7,
    topCut: null,
    matchFormat: "Bo3",
    timeLimit: 40,
    seats: 64,
    taken: 12,
    entry: "Free entry",
    host: "Dueling Nexus",
    signupUrl: "#",
  },
  {
    slug: "heroic-challenger-cup",
    name: "Heroic Challenger Cup",
    startsAt: "2026-09-05T20:00:00Z",
    structure: "mixed",
    rounds: 6,
    topCut: 8,
    matchFormat: "Bo3",
    timeLimit: 40,
    seats: 128,
    taken: 74,
    entry: "Free · Duel Points",
    host: "Dueling Nexus",
    signupUrl: "#",
  },
  {
    slug: "xyz-gauntlet",
    name: "Xyz Gauntlet",
    startsAt: "2026-09-06T23:00:00Z",
    structure: "single-elim",
    rounds: 5,
    topCut: null,
    matchFormat: "Bo1",
    timeLimit: 30,
    seats: 32,
    taken: 27,
    entry: "Free entry",
    host: "REDU Format Discord",
    signupUrl: "#",
  },
  {
    slug: "september-list-classic",
    name: "September List Classic",
    startsAt: "2026-09-12T17:30:00Z",
    structure: "swiss",
    rounds: 5,
    topCut: null,
    matchFormat: "Bo3",
    timeLimit: 40,
    seats: 64,
    taken: 33,
    entry: "Free entry",
    host: "Dueling Nexus",
    signupUrl: "#",
  },
  {
    slug: "prophecy-open",
    name: "Prophecy Open",
    startsAt: "2026-09-13T19:00:00Z",
    structure: "mixed",
    rounds: 7,
    topCut: 4,
    matchFormat: "Bo3",
    timeLimit: 45,
    seats: 128,
    taken: 96,
    entry: "Free · Playmat for winner",
    host: "REDU Format Discord",
    signupUrl: "#",
  },
  {
    slug: "elemental-lord-bracket",
    name: "Elemental Lord Bracket",
    startsAt: "2026-09-19T21:00:00Z",
    structure: "single-elim",
    rounds: 4,
    topCut: null,
    matchFormat: "Bo3",
    timeLimit: 45,
    seats: 16,
    taken: 9,
    entry: "Free entry",
    host: "Dueling Nexus",
    signupUrl: "#",
  },
  {
    slug: "redu-weekly-53",
    name: "REDU Weekly #53",
    startsAt: "2026-09-20T23:00:00Z",
    structure: "swiss",
    rounds: 5,
    topCut: null,
    matchFormat: "Bo3",
    timeLimit: 40,
    seats: 64,
    taken: 21,
    entry: "Free entry",
    host: "Dueling Nexus",
    signupUrl: "#",
  },
  {
    slug: "nexus-retro-championship",
    name: "Nexus Retro Championship",
    startsAt: "2026-09-26T16:00:00Z",
    structure: "mixed",
    rounds: 9,
    topCut: 8,
    matchFormat: "Bo3",
    timeLimit: 50,
    seats: 512,
    taken: 288,
    entry: "Free · Prize support",
    host: "Dueling Nexus",
    signupUrl: "#",
  },
  {
    slug: "dino-rabbit-rumble",
    name: "Dino Rabbit Rumble",
    startsAt: "2026-09-27T20:30:00Z",
    structure: "single-elim",
    rounds: 5,
    topCut: null,
    matchFormat: "Bo3",
    timeLimit: 45,
    seats: 32,
    taken: 32,
    entry: "Free entry",
    host: "REDU Format Discord",
    signupUrl: "#",
  },
  {
    slug: "tengu-trials",
    name: "Tengu Trials",
    startsAt: "2026-10-03T18:00:00Z",
    structure: "swiss",
    rounds: 6,
    topCut: null,
    matchFormat: "Bo3",
    timeLimit: 40,
    seats: 96,
    taken: 44,
    entry: "Free · Series points",
    host: "REDU Format Discord",
    signupUrl: "#",
  },
  {
    slug: "agent-ascension",
    name: "Agent Ascension",
    startsAt: "2026-10-04T22:00:00Z",
    structure: "mixed",
    rounds: 6,
    topCut: 8,
    matchFormat: "Bo3",
    timeLimit: 40,
    seats: 128,
    taken: 61,
    entry: "Free · Duel Points",
    host: "Dueling Nexus",
    signupUrl: "#",
  },
  {
    slug: "inzektor-last-call",
    name: "Inzektor Last Call",
    startsAt: "2026-07-18T19:00:00Z",
    structure: "swiss",
    rounds: 5,
    topCut: null,
    matchFormat: "Bo3",
    timeLimit: 40,
    seats: 64,
    taken: 64,
    entry: "Free entry",
    host: "Dueling Nexus",
    signupUrl: "#",
  },
  {
    slug: "wind-up-cup-x",
    name: "Wind-Up Cup X",
    startsAt: "2026-07-25T18:00:00Z",
    structure: "mixed",
    rounds: 6,
    topCut: 8,
    matchFormat: "Bo3",
    timeLimit: 40,
    seats: 128,
    taken: 128,
    entry: "Free · Playmat for Top 4",
    host: "REDU Format Discord",
    signupUrl: "#",
  },
  {
    slug: "laggia-bracket-night",
    name: "Laggia Bracket Night",
    startsAt: "2026-07-31T23:30:00Z",
    structure: "single-elim",
    rounds: 4,
    topCut: null,
    matchFormat: "Bo1",
    timeLimit: 30,
    seats: 16,
    taken: 16,
    entry: "Free entry",
    host: "Dueling Nexus",
    signupUrl: "#",
  },
  {
    slug: "redu-weekly-51",
    name: "REDU Weekly #51",
    startsAt: "2026-08-05T23:00:00Z",
    structure: "swiss",
    rounds: 5,
    topCut: null,
    matchFormat: "Bo3",
    timeLimit: 40,
    seats: 64,
    taken: 57,
    entry: "Free entry",
    host: "Dueling Nexus",
    signupUrl: "#",
  },
  {
    slug: "six-samurai-showdown",
    name: "Six Samurai Showdown",
    startsAt: "2026-08-08T20:00:00Z",
    structure: "mixed",
    rounds: 5,
    topCut: 4,
    matchFormat: "Bo3",
    timeLimit: 40,
    seats: 64,
    taken: 52,
    entry: "Free · Duel Points",
    host: "REDU Format Discord",
    signupUrl: "#",
  },
];

/** Past events, kept for the archive view. Attendance varies on purpose. */
export const pastEvents: readonly TournamentEvent[] = [
  {
    slug: "redu-weekly-49",
    name: "REDU Weekly #49",
    startsAt: "2026-07-22T23:00:00Z",
    structure: "swiss",
    rounds: 4,
    topCut: null,
    matchFormat: "Bo3",
    timeLimit: 40,
    seats: 64,
    taken: 8,
    entry: "Free entry",
    host: "Dueling Nexus",
    signupUrl: "#",
  },
  {
    slug: "redu-weekly-48",
    name: "REDU Weekly #48",
    startsAt: "2026-07-15T23:00:00Z",
    structure: "swiss",
    rounds: 5,
    topCut: null,
    matchFormat: "Bo3",
    timeLimit: 40,
    seats: 64,
    taken: 39,
    entry: "Free entry",
    host: "Dueling Nexus",
    signupUrl: "#",
  },
  {
    slug: "zexal-series-stage-2",
    name: "Zexal Series: Stage 2",
    startsAt: "2026-07-11T19:00:00Z",
    structure: "swiss",
    rounds: 6,
    topCut: null,
    matchFormat: "Bo3",
    timeLimit: 40,
    seats: 96,
    taken: 88,
    entry: "Free · Series points",
    host: "Dueling Nexus",
    signupUrl: "#",
  },
  {
    slug: "dark-world-derby",
    name: "Dark World Derby",
    startsAt: "2026-07-04T21:00:00Z",
    structure: "single-elim",
    rounds: 4,
    topCut: null,
    matchFormat: "Bo3",
    timeLimit: 45,
    seats: 32,
    taken: 14,
    entry: "Free entry",
    host: "REDU Format Discord",
    signupUrl: "#",
  },
  {
    slug: "zexal-series-stage-1",
    name: "Zexal Series: Stage 1",
    startsAt: "2026-06-27T19:00:00Z",
    structure: "swiss",
    rounds: 6,
    topCut: null,
    matchFormat: "Bo3",
    timeLimit: 40,
    seats: 96,
    taken: 71,
    entry: "Free · Series points",
    host: "Dueling Nexus",
    signupUrl: "#",
  },
  {
    slug: "geargia-grand-prix",
    name: "Geargia Grand Prix",
    startsAt: "2026-06-20T18:00:00Z",
    structure: "mixed",
    rounds: 7,
    topCut: 8,
    matchFormat: "Bo3",
    timeLimit: 45,
    seats: 128,
    taken: 128,
    entry: "Free · Playmat for Top 4",
    host: "REDU Format Discord",
    signupUrl: "#",
  },
  {
    slug: "summer-nexus-cup",
    name: "Summer Nexus Cup",
    startsAt: "2026-06-13T20:00:00Z",
    structure: "mixed",
    rounds: 6,
    topCut: 4,
    matchFormat: "Bo3",
    timeLimit: 40,
    seats: 128,
    taken: 63,
    entry: "Free · Duel Points",
    host: "Dueling Nexus",
    signupUrl: "#",
  },
  {
    slug: "rescue-rabbit-rampage",
    name: "Rescue Rabbit Rampage",
    startsAt: "2026-05-30T22:00:00Z",
    structure: "single-elim",
    rounds: 4,
    topCut: null,
    matchFormat: "Bo1",
    timeLimit: 30,
    seats: 16,
    taken: 16,
    entry: "Free entry",
    host: "REDU Format Discord",
    signupUrl: "#",
  },
  {
    slug: "lightsworn-ladder-finals",
    name: "Lightsworn Ladder Finals",
    startsAt: "2026-05-16T21:00:00Z",
    structure: "single-elim",
    rounds: 5,
    topCut: null,
    matchFormat: "Bo3",
    timeLimit: 45,
    seats: 32,
    taken: 31,
    entry: "Free · Duel Points",
    host: "Dueling Nexus",
    signupUrl: "#",
  },
  {
    slug: "providence-memorial-2025",
    name: "Providence Memorial 2025",
    startsAt: "2025-10-20T17:00:00Z",
    structure: "mixed",
    rounds: 9,
    topCut: 8,
    matchFormat: "Bo3",
    timeLimit: 50,
    seats: 256,
    taken: 241,
    entry: "Free · Prize support",
    host: "REDU Format Discord",
    signupUrl: "#",
  },
];

export const allEvents: readonly TournamentEvent[] = [...events, ...pastEvents];

export const PAGE_SIZE = 8;

/** Fraction of seats claimed, 0 to 1. */
export function fillRatio(event: TournamentEvent): number {
  if (event.seats <= 0) return 1;
  return Math.min(1, event.taken / event.seats);
}

export function isPast(event: TournamentEvent, now: Date): boolean {
  return new Date(event.startsAt).getTime() < now.getTime();
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
  const nowMs = now.getTime();

  let items = all.filter((event) => {
    if (query.structure && query.structure !== "all") {
      if (event.structure !== query.structure) return false;
    }

    const started = new Date(event.startsAt).getTime() < nowMs;
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
