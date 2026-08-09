import assert from "node:assert/strict";
import test from "node:test";
import {
  ALMOST_FULL,
  allEvents as events,
  fillRatio,
  isPast,
  PAGE_SIZE,
  queryEvents,
  seatsLeft,
  type TournamentEvent,
} from "./events.ts";

const NOW = new Date("2026-08-09T12:00:00Z");

test("no filters returns every event, paged", () => {
  const first = queryEvents(events, {}, NOW);
  assert.equal(first.total, events.length);
  assert.equal(first.items.length, PAGE_SIZE);
  assert.equal(first.page, 1);
  assert.equal(first.pages, Math.ceil(events.length / PAGE_SIZE));
});

test("structure filter keeps only that structure", () => {
  for (const structure of ["swiss", "single-elim", "mixed"] as const) {
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
    { structure: "mixed", when: "upcoming", seats: "open" },
    NOW,
  );
  assert.ok(items.length > 0);
  assert.ok(
    items.every(
      (e) =>
        e.structure === "mixed" &&
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
