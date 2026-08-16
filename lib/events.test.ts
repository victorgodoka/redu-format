import assert from "node:assert/strict";
import test from "node:test";
import {
  ALMOST_FULL,
  fillRatio,
  formatEntry,
  isFinished,
  isPast,
  PAGE_SIZE,
  queryEvents,
  recommendedTopCut,
  seatsLeft,
  type TournamentEvent,
} from "./events.ts";

const NOW = new Date("2026-08-09T12:00:00Z");

/** Fixture spanning every structure, status and seat-fill state the filter/paging tests exercise. */
const events: TournamentEvent[] = [
    {
      slug: "redu-weekly-52",
      name: "REDU Weekly #52",
      startsAt: "2026-08-12T23:00:00Z",
      structure: "swiss",
      rounds: 5,
      topCut: null,
      startedAt: null,
      finishedAt: null,
      status: "scheduled",
      cancelledAt: null,
      matchFormat: "Bo3",
      roundLimitDays: 2,
      seats: 64,
      taken: 41,
      entry: { type: "free" },
      host: "Dueling Nexus",
      engine: "dueling-nexus",
      signupUrl: "#",
    },
    {
      slug: "wind-up-cup-xi",
      name: "Wind-Up Cup XI",
      startsAt: "2026-08-15T18:00:00Z",
      structure: "swiss",
      rounds: 6,
      topCut: 8,
      startedAt: null,
      finishedAt: null,
      status: "scheduled",
      cancelledAt: null,
      matchFormat: "Bo3",
      roundLimitDays: 2,
      seats: 128,
      taken: 128,
      entry: { type: "free" },
      host: "REDU Format Discord",
      engine: "dueling-nexus",
      signupUrl: "#",
    },
    {
      slug: "gear-gigant-open",
      name: "Gear Gigant Open",
      startsAt: "2026-08-16T21:30:00Z",
      structure: "single-elim",
      rounds: 5,
      topCut: null,
      startedAt: null,
      finishedAt: null,
      status: "scheduled",
      cancelledAt: null,
      matchFormat: "Bo3",
      roundLimitDays: 2,
      seats: 32,
      taken: 19,
      entry: { type: "free" },
      host: "Dueling Nexus",
      engine: "dueling-nexus",
      signupUrl: "#",
    },
    {
      slug: "providence-memorial-2026",
      name: "Providence Memorial 2026",
      startsAt: "2026-10-20T17:00:00Z",
      structure: "swiss",
      rounds: 8,
      topCut: 8,
      startedAt: null,
      finishedAt: null,
      status: "scheduled",
      cancelledAt: null,
      matchFormat: "Bo3",
      roundLimitDays: 2,
      seats: 256,
      taken: 173,
      entry: { type: "free" },
      host: "REDU Format Discord",
      engine: "dueling-nexus",
      signupUrl: "#",
    },
    {
      slug: "zexal-series-stage-3",
      name: "Zexal Series: Stage 3",
      startsAt: "2026-08-22T19:00:00Z",
      structure: "swiss",
      rounds: 6,
      topCut: null,
      startedAt: null,
      finishedAt: null,
      status: "scheduled",
      cancelledAt: null,
      matchFormat: "Bo3",
      roundLimitDays: 2,
      seats: 96,
      taken: 58,
      entry: { type: "free" },
      host: "Dueling Nexus",
      engine: "dueling-nexus",
      signupUrl: "#",
    },
    {
      slug: "chaos-dragon-invitational",
      name: "Chaos Dragon Invitational",
      startsAt: "2026-08-23T22:00:00Z",
      structure: "single-elim",
      rounds: 4,
      topCut: null,
      startedAt: null,
      finishedAt: null,
      status: "scheduled",
      cancelledAt: null,
      matchFormat: "Bo3",
      roundLimitDays: 2,
      seats: 16,
      taken: 16,
      entry: { type: "free" },
      host: "REDU Format Discord",
      engine: "dueling-nexus",
      signupUrl: "#",
    },
    {
      slug: "madolche-marathon",
      name: "Madolche Marathon",
      startsAt: "2026-08-29T18:30:00Z",
      structure: "swiss",
      rounds: 7,
      topCut: null,
      startedAt: null,
      finishedAt: null,
      status: "scheduled",
      cancelledAt: null,
      matchFormat: "Bo3",
      roundLimitDays: 2,
      seats: 64,
      taken: 12,
      entry: { type: "free" },
      host: "Dueling Nexus",
      engine: "dueling-nexus",
      signupUrl: "#",
    },
    {
      slug: "heroic-challenger-cup",
      name: "Heroic Challenger Cup",
      startsAt: "2026-09-05T20:00:00Z",
      structure: "swiss",
      rounds: 6,
      topCut: 8,
      startedAt: null,
      finishedAt: null,
      status: "scheduled",
      cancelledAt: null,
      matchFormat: "Bo3",
      roundLimitDays: 2,
      seats: 128,
      taken: 74,
      entry: { type: "free" },
      host: "Dueling Nexus",
      engine: "dueling-nexus",
      signupUrl: "#",
    },
    {
      slug: "xyz-gauntlet",
      name: "Xyz Gauntlet",
      startsAt: "2026-09-06T23:00:00Z",
      structure: "single-elim",
      rounds: 5,
      topCut: null,
      startedAt: null,
      finishedAt: null,
      status: "scheduled",
      cancelledAt: null,
      matchFormat: "Bo1",
      roundLimitDays: 2,
      seats: 32,
      taken: 27,
      entry: { type: "free" },
      host: "REDU Format Discord",
      engine: "dueling-nexus",
      signupUrl: "#",
    },
    {
      slug: "september-list-classic",
      name: "September List Classic",
      startsAt: "2026-09-12T17:30:00Z",
      structure: "swiss",
      rounds: 5,
      topCut: null,
      startedAt: null,
      finishedAt: null,
      status: "scheduled",
      cancelledAt: null,
      matchFormat: "Bo3",
      roundLimitDays: 2,
      seats: 64,
      taken: 33,
      entry: { type: "free" },
      host: "Dueling Nexus",
      engine: "dueling-nexus",
      signupUrl: "#",
    },
    {
      slug: "prophecy-open",
      name: "Prophecy Open",
      startsAt: "2026-09-13T19:00:00Z",
      structure: "swiss",
      rounds: 7,
      topCut: 4,
      startedAt: null,
      finishedAt: null,
      status: "scheduled",
      cancelledAt: null,
      matchFormat: "Bo3",
      roundLimitDays: 2,
      seats: 128,
      taken: 96,
      entry: { type: "free" },
      host: "REDU Format Discord",
      engine: "dueling-nexus",
      signupUrl: "#",
    },
    {
      slug: "elemental-lord-bracket",
      name: "Elemental Lord Bracket",
      startsAt: "2026-09-19T21:00:00Z",
      structure: "single-elim",
      rounds: 4,
      topCut: null,
      startedAt: null,
      finishedAt: null,
      status: "scheduled",
      cancelledAt: null,
      matchFormat: "Bo3",
      roundLimitDays: 2,
      seats: 16,
      taken: 9,
      entry: { type: "free" },
      host: "Dueling Nexus",
      engine: "dueling-nexus",
      signupUrl: "#",
    },
    {
      slug: "redu-weekly-53",
      name: "REDU Weekly #53",
      startsAt: "2026-09-20T23:00:00Z",
      structure: "swiss",
      rounds: 5,
      topCut: null,
      startedAt: null,
      finishedAt: null,
      status: "scheduled",
      cancelledAt: null,
      matchFormat: "Bo3",
      roundLimitDays: 2,
      seats: 64,
      taken: 21,
      entry: { type: "free" },
      host: "Dueling Nexus",
      engine: "dueling-nexus",
      signupUrl: "#",
    },
    {
      slug: "nexus-retro-championship",
      name: "Nexus Retro Championship",
      startsAt: "2026-09-26T16:00:00Z",
      structure: "swiss",
      rounds: 9,
      topCut: 8,
      startedAt: null,
      finishedAt: null,
      status: "scheduled",
      cancelledAt: null,
      matchFormat: "Bo3",
      roundLimitDays: 2,
      seats: 512,
      taken: 288,
      entry: { type: "free" },
      host: "Dueling Nexus",
      engine: "dueling-nexus",
      signupUrl: "#",
    },
    {
      slug: "dino-rabbit-rumble",
      name: "Dino Rabbit Rumble",
      startsAt: "2026-09-27T20:30:00Z",
      structure: "single-elim",
      rounds: 5,
      topCut: null,
      startedAt: null,
      finishedAt: null,
      status: "scheduled",
      cancelledAt: null,
      matchFormat: "Bo3",
      roundLimitDays: 2,
      seats: 32,
      taken: 32,
      entry: { type: "free" },
      host: "REDU Format Discord",
      engine: "dueling-nexus",
      signupUrl: "#",
    },
    {
      slug: "tengu-trials",
      name: "Tengu Trials",
      startsAt: "2026-10-03T18:00:00Z",
      structure: "swiss",
      rounds: 6,
      topCut: null,
      startedAt: null,
      finishedAt: null,
      status: "scheduled",
      cancelledAt: null,
      matchFormat: "Bo3",
      roundLimitDays: 2,
      seats: 96,
      taken: 44,
      entry: { type: "free" },
      host: "REDU Format Discord",
      engine: "dueling-nexus",
      signupUrl: "#",
    },
    {
      slug: "agent-ascension",
      name: "Agent Ascension",
      startsAt: "2026-10-04T22:00:00Z",
      structure: "swiss",
      rounds: 6,
      topCut: 8,
      startedAt: null,
      finishedAt: null,
      status: "scheduled",
      cancelledAt: null,
      matchFormat: "Bo3",
      roundLimitDays: 2,
      seats: 128,
      taken: 61,
      entry: { type: "free" },
      host: "Dueling Nexus",
      engine: "dueling-nexus",
      signupUrl: "#",
    },
    {
      slug: "inzektor-last-call",
      name: "Inzektor Last Call",
      startsAt: "2026-07-18T19:00:00Z",
      structure: "swiss",
      rounds: 5,
      topCut: null,
      startedAt: null,
      finishedAt: null,
      status: "scheduled",
      cancelledAt: null,
      matchFormat: "Bo3",
      roundLimitDays: 2,
      seats: 64,
      taken: 64,
      entry: { type: "free" },
      host: "Dueling Nexus",
      engine: "dueling-nexus",
      signupUrl: "#",
    },
    {
      slug: "wind-up-cup-x",
      name: "Wind-Up Cup X",
      startsAt: "2026-07-25T18:00:00Z",
      structure: "swiss",
      rounds: 6,
      topCut: 8,
      startedAt: null,
      finishedAt: null,
      status: "scheduled",
      cancelledAt: null,
      matchFormat: "Bo3",
      roundLimitDays: 2,
      seats: 128,
      taken: 128,
      entry: { type: "free" },
      host: "REDU Format Discord",
      engine: "dueling-nexus",
      signupUrl: "#",
    },
    {
      slug: "laggia-bracket-night",
      name: "Laggia Bracket Night",
      startsAt: "2026-07-31T23:30:00Z",
      structure: "single-elim",
      rounds: 4,
      topCut: null,
      startedAt: null,
      finishedAt: null,
      status: "scheduled",
      cancelledAt: null,
      matchFormat: "Bo1",
      roundLimitDays: 2,
      seats: 16,
      taken: 16,
      entry: { type: "free" },
      host: "Dueling Nexus",
      engine: "dueling-nexus",
      signupUrl: "#",
    },
    {
      slug: "redu-weekly-51",
      name: "REDU Weekly #51",
      startsAt: "2026-08-05T23:00:00Z",
      structure: "swiss",
      rounds: 5,
      topCut: null,
      startedAt: null,
      finishedAt: null,
      status: "scheduled",
      cancelledAt: null,
      matchFormat: "Bo3",
      roundLimitDays: 2,
      seats: 64,
      taken: 57,
      entry: { type: "free" },
      host: "Dueling Nexus",
      engine: "dueling-nexus",
      signupUrl: "#",
    },
    {
      slug: "six-samurai-showdown",
      name: "Six Samurai Showdown",
      startsAt: "2026-08-08T20:00:00Z",
      structure: "swiss",
      rounds: 5,
      topCut: 4,
      startedAt: null,
      finishedAt: null,
      status: "scheduled",
      cancelledAt: null,
      matchFormat: "Bo3",
      roundLimitDays: 2,
      seats: 64,
      taken: 52,
      entry: { type: "free" },
      host: "REDU Format Discord",
      engine: "dueling-nexus",
      signupUrl: "#",
    },
    {
      slug: "redu-weekly-49",
      name: "REDU Weekly #49",
      startsAt: "2026-07-22T23:00:00Z",
      structure: "swiss",
      rounds: 4,
      topCut: null,
      startedAt: "2026-07-22T23:00:00Z",
      finishedAt: "2026-07-22T23:00:00Z",
      status: "finished",
      cancelledAt: null,
      matchFormat: "Bo3",
      roundLimitDays: 2,
      seats: 64,
      taken: 8,
      entry: { type: "free" },
      host: "Dueling Nexus",
      engine: "dueling-nexus",
      signupUrl: "#",
    },
    {
      slug: "redu-weekly-48",
      name: "REDU Weekly #48",
      startsAt: "2026-07-15T23:00:00Z",
      structure: "swiss",
      rounds: 5,
      topCut: null,
      startedAt: "2026-07-15T23:00:00Z",
      finishedAt: "2026-07-15T23:00:00Z",
      status: "finished",
      cancelledAt: null,
      matchFormat: "Bo3",
      roundLimitDays: 2,
      seats: 64,
      taken: 39,
      entry: { type: "free" },
      host: "Dueling Nexus",
      engine: "dueling-nexus",
      signupUrl: "#",
    },
    {
      slug: "zexal-series-stage-2",
      name: "Zexal Series: Stage 2",
      startsAt: "2026-07-11T19:00:00Z",
      structure: "swiss",
      rounds: 6,
      topCut: null,
      startedAt: "2026-07-11T19:00:00Z",
      finishedAt: "2026-07-11T19:00:00Z",
      status: "finished",
      cancelledAt: null,
      matchFormat: "Bo3",
      roundLimitDays: 2,
      seats: 96,
      taken: 88,
      entry: { type: "free" },
      host: "Dueling Nexus",
      engine: "dueling-nexus",
      signupUrl: "#",
    },
    {
      slug: "dark-world-derby",
      name: "Dark World Derby",
      startsAt: "2026-07-04T21:00:00Z",
      structure: "single-elim",
      rounds: 4,
      topCut: null,
      startedAt: "2026-07-04T21:00:00Z",
      finishedAt: "2026-07-04T21:00:00Z",
      status: "finished",
      cancelledAt: null,
      matchFormat: "Bo3",
      roundLimitDays: 2,
      seats: 32,
      taken: 14,
      entry: { type: "free" },
      host: "REDU Format Discord",
      engine: "dueling-nexus",
      signupUrl: "#",
    },
    {
      slug: "zexal-series-stage-1",
      name: "Zexal Series: Stage 1",
      startsAt: "2026-06-27T19:00:00Z",
      structure: "swiss",
      rounds: 6,
      topCut: null,
      startedAt: "2026-06-27T19:00:00Z",
      finishedAt: "2026-06-27T19:00:00Z",
      status: "finished",
      cancelledAt: null,
      matchFormat: "Bo3",
      roundLimitDays: 2,
      seats: 96,
      taken: 71,
      entry: { type: "free" },
      host: "Dueling Nexus",
      engine: "dueling-nexus",
      signupUrl: "#",
    },
    {
      slug: "geargia-grand-prix",
      name: "Geargia Grand Prix",
      startsAt: "2026-06-20T18:00:00Z",
      structure: "swiss",
      rounds: 7,
      topCut: 8,
      startedAt: "2026-06-20T18:00:00Z",
      finishedAt: "2026-06-20T18:00:00Z",
      status: "finished",
      cancelledAt: null,
      matchFormat: "Bo3",
      roundLimitDays: 2,
      seats: 128,
      taken: 128,
      entry: { type: "free" },
      host: "REDU Format Discord",
      engine: "dueling-nexus",
      signupUrl: "#",
    },
    {
      slug: "summer-nexus-cup",
      name: "Summer Nexus Cup",
      startsAt: "2026-06-13T20:00:00Z",
      structure: "swiss",
      rounds: 6,
      topCut: 4,
      startedAt: "2026-06-13T20:00:00Z",
      finishedAt: "2026-06-13T20:00:00Z",
      status: "finished",
      cancelledAt: null,
      matchFormat: "Bo3",
      roundLimitDays: 2,
      seats: 128,
      taken: 63,
      entry: { type: "free" },
      host: "Dueling Nexus",
      engine: "dueling-nexus",
      signupUrl: "#",
    },
    {
      slug: "rescue-rabbit-rampage",
      name: "Rescue Rabbit Rampage",
      startsAt: "2026-05-30T22:00:00Z",
      structure: "single-elim",
      rounds: 4,
      topCut: null,
      startedAt: "2026-05-30T22:00:00Z",
      finishedAt: "2026-05-30T22:00:00Z",
      status: "finished",
      cancelledAt: null,
      matchFormat: "Bo1",
      roundLimitDays: 2,
      seats: 16,
      taken: 16,
      entry: { type: "free" },
      host: "REDU Format Discord",
      engine: "dueling-nexus",
      signupUrl: "#",
    },
    {
      slug: "lightsworn-ladder-finals",
      name: "Lightsworn Ladder Finals",
      startsAt: "2026-05-16T21:00:00Z",
      structure: "single-elim",
      rounds: 5,
      topCut: null,
      startedAt: "2026-05-16T21:00:00Z",
      finishedAt: "2026-05-16T21:00:00Z",
      status: "finished",
      cancelledAt: null,
      matchFormat: "Bo3",
      roundLimitDays: 2,
      seats: 32,
      taken: 31,
      entry: { type: "free" },
      host: "Dueling Nexus",
      engine: "dueling-nexus",
      signupUrl: "#",
    },
    {
      slug: "providence-memorial-2025",
      name: "Providence Memorial 2025",
      startsAt: "2025-10-20T17:00:00Z",
      structure: "swiss",
      rounds: 9,
      topCut: 8,
      startedAt: "2025-10-20T17:00:00Z",
      finishedAt: "2025-10-20T17:00:00Z",
      status: "finished",
      cancelledAt: null,
      matchFormat: "Bo3",
      roundLimitDays: 2,
      seats: 256,
      taken: 241,
      entry: { type: "free" },
      host: "REDU Format Discord",
      engine: "dueling-nexus",
      signupUrl: "#",
    },
];

test("no filters returns every event, paged", () => {
  const first = queryEvents(events, {}, NOW);
  assert.equal(first.total, events.length);
  assert.equal(first.items.length, PAGE_SIZE);
  assert.equal(first.page, 1);
  assert.equal(first.pages, Math.ceil(events.length / PAGE_SIZE));
});

test("structure filter keeps only that structure", () => {
  for (const structure of ["swiss", "single-elim"] as const) {
    const { items, total } = queryEvents(events, { structure }, NOW);
    assert.ok(total > 0, `${structure} should have events`);
    assert.ok(items.every((e) => e.structure === structure));
  }
});

test("upcoming and past split on now and never overlap", () => {
  const upcoming = queryEvents(events, { when: "upcoming" }, NOW);
  const past = queryEvents(events, { when: "past" }, NOW);

  assert.equal(upcoming.total + past.total, events.length);
  assert.ok(upcoming.items.every((e) => new Date(e.startsAt) >= NOW));
  assert.ok(past.items.every((e) => new Date(e.startsAt) < NOW));
});

test("upcoming sorts soonest first, past sorts most recent first", () => {
  const upcoming = queryEvents(events, { when: "upcoming" }, NOW).items;
  const past = queryEvents(events, { when: "past" }, NOW).items;

  const times = (list: TournamentEvent[]) =>
    list.map((e) => new Date(e.startsAt).getTime());

  assert.deepEqual(times(upcoming), [...times(upcoming)].sort((a, b) => a - b));
  assert.deepEqual(times(past), [...times(past)].sort((a, b) => b - a));
});

test("isPast: a bracket started ahead of its advertised time is no longer upcoming", () => {
  const scheduledForTomorrow: TournamentEvent = {
    ...events[0],
    startsAt: new Date(NOW.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    status: "running",
    startedAt: new Date(NOW.getTime() - 60 * 1000).toISOString(), // started a minute ago
  };

  assert.equal(isPast(scheduledForTomorrow, NOW), true);
  assert.ok(!queryEvents([scheduledForTomorrow], { when: "upcoming" }, NOW).items.length);
  assert.equal(queryEvents([scheduledForTomorrow], { when: "past" }, NOW).items.length, 1);
});

test("isFinished: in-progress (started, not finished) is distinct from finished", () => {
  const inProgress: TournamentEvent = {
    ...events[0],
    status: "running",
    startedAt: new Date(NOW.getTime() - 60 * 1000).toISOString(),
    finishedAt: null,
  };
  const finished: TournamentEvent = { ...inProgress, status: "finished", finishedAt: NOW.toISOString() };

  assert.equal(isPast(inProgress, NOW), true, "in progress is no longer upcoming");
  assert.equal(isFinished(inProgress), false, "but it isn't finished yet");
  assert.equal(isFinished(finished), true);
});

test("seat filters split on availability", () => {
  const open = queryEvents(events, { seats: "open" }, NOW);
  const full = queryEvents(events, { seats: "full" }, NOW);

  assert.ok(open.total > 0);
  assert.ok(full.total > 0, "the mock needs at least one sold-out event");
  assert.equal(open.total + full.total, events.length);
  assert.ok(open.items.every((e) => seatsLeft(e) > 0));
  assert.ok(full.items.every((e) => seatsLeft(e) === 0));
});

test("filters combine", () => {
  const { items } = queryEvents(
    events,
    { structure: "swiss", when: "upcoming", seats: "open" },
    NOW,
  );
  assert.ok(items.length > 0);
  assert.ok(
    items.every(
      (e) =>
        e.structure === "swiss" &&
        new Date(e.startsAt) >= NOW &&
        seatsLeft(e) > 0,
    ),
  );
});

test("pages do not repeat or drop events", () => {
  const { pages, total } = queryEvents(events, {}, NOW);
  const seen: string[] = [];

  for (let p = 1; p <= pages; p++) {
    seen.push(
      ...queryEvents(events, { page: String(p) }, NOW).items.map((e) => e.slug),
    );
  }

  assert.equal(seen.length, total);
  assert.equal(new Set(seen).size, total);
});

test("a broken page value lands on a real page instead of an empty one", () => {
  const { pages } = queryEvents(events, {}, NOW);

  for (const page of ["0", "-3", "999", "abc", "", "1e9"]) {
    const result = queryEvents(events, { page }, NOW);
    assert.ok(
      result.page >= 1 && result.page <= pages,
      `page=${page} gave ${result.page}`,
    );
    assert.ok(result.items.length > 0, `page=${page} rendered nothing`);
  }
});

test("an unknown structure is ignored rather than emptying the list", () => {
  const result = queryEvents(events, { structure: "all" }, NOW);
  assert.equal(result.total, events.length);
});

test("the last page is never over-filled", () => {
  const { pages } = queryEvents(events, {}, NOW);
  const last = queryEvents(events, { page: String(pages) }, NOW);
  assert.ok(last.items.length > 0 && last.items.length <= PAGE_SIZE);
});

test("the archive has finished events at a range of attendance", () => {
  const past = queryEvents(events, { when: "past" }, NOW).items.concat(
    queryEvents(events, { when: "past", page: "2" }, NOW).items,
  );

  assert.ok(past.length >= 10, "expected a real archive to browse");
  assert.ok(
    past.some((e) => seatsLeft(e) === 0),
    "expected at least one sold-out past event",
  );
  assert.ok(
    past.some((e) => fillRatio(e) < 0.3),
    "expected at least one poorly attended past event",
  );
  assert.ok(past.every((e) => isPast(e, NOW)));
});

test("almost-full excludes sold out and anything under the threshold", () => {
  const { items, total } = queryEvents(
    events,
    { seats: "almost", when: "all" },
    NOW,
  );

  assert.ok(total > 0, "the mock needs an almost-full event");
  assert.ok(
    items.every((e) => seatsLeft(e) > 0 && fillRatio(e) >= ALMOST_FULL),
    "almost-full must stay joinable and at or above the threshold",
  );
});

test("open, almost and sold out never double count", () => {
  const q = (seats: string) =>
    queryEvents(events, { seats, when: "all" }, NOW).total;

  // almost is a subset of open, so open already covers it.
  assert.equal(q("open") + q("full"), events.length);
  assert.ok(q("almost") <= q("open"));
});

test("uncapped events are never sold out or almost full", () => {
  const event: TournamentEvent = {
    slug: "open-invite",
    name: "Open Invite",
    startsAt: "2027-01-01T00:00:00Z",
    structure: "swiss",
    rounds: 5,
    topCut: null,
    matchFormat: "Bo3",
    roundLimitDays: 2,
    engine: "dueling-nexus",
    seats: null,
    taken: 5000,
    entry: { type: "free" },
    host: "Dueling Nexus",
    signupUrl: "#",
  };

  assert.equal(seatsLeft(event), Infinity);
  assert.equal(fillRatio(event), 0);
});

test("formatEntry renders free plainly and paid with its currency", () => {
  assert.equal(formatEntry({ type: "free" }), "Free entry");
  assert.equal(formatEntry({ type: "paid", amount: 10, currency: "USD" }), "$10.00");
  assert.equal(formatEntry({ type: "paid", amount: 25.5, currency: "BRL" }), "R$25.50");
});

test("recommendedTopCut follows the field-size table", () => {
  assert.equal(recommendedTopCut(8), null);
  assert.equal(recommendedTopCut(9), 4);
  assert.equal(recommendedTopCut(16), 4);
  assert.equal(recommendedTopCut(17), 8);
  assert.equal(recommendedTopCut(128), 8);
  assert.equal(recommendedTopCut(129), 16);
  assert.equal(recommendedTopCut(256), 16);
  assert.equal(recommendedTopCut(257), 32);
  assert.equal(recommendedTopCut(512), 32);
  assert.equal(recommendedTopCut(513), 64);
  assert.equal(recommendedTopCut(2000), 64);
});
