import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { findPlayerIdByToken } from "@/lib/backend/services/player.service";
import { listSavedSlugsForPlayer, listSignupsForPlayer } from "@/lib/backend/services/registration.service";
import {
  ALMOST_FULL,
  FEATURED_EVENT,
  fillRatio,
  formatDate,
  formatEntry,
  formatTime,
  isPast,
  pastEvents,
  queryEvents,
  seatsLeft,
  STRUCTURES,
  type EventQuery,
} from "@/lib/events";
import { listTournaments } from "@/lib/tournaments";
import { saveTournamentAction, unsaveTournamentAction } from "./saved-actions";
import SiteHeader from "../site-header";

export const metadata: Metadata = {
  title: "REDU Format events | Tournaments and schedule",
  description:
    "Upcoming REDU Format tournaments: Swiss, Single Elimination and Swiss into Top Cut, with dates, seat counts and signups.",
  alternates: { canonical: "/events" },
  openGraph: {
    type: "website",
    url: "/events",
    siteName: "REDU Format",
    title: "REDU Format events | Tournaments and schedule",
    description:
      "Upcoming REDU Format tournaments: Swiss, Single Elimination and Swiss into Top Cut.",
  },
};

const structureOptions = [
  { value: "all", label: "All structures" },
  { value: "swiss", label: "Swiss" },
  { value: "single-elim", label: "Single Elimination" },
  { value: "double-elim", label: "Double Elimination" },
];

const whenOptions = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "all", label: "Any date" },
];

const seatOptions = [
  { value: "all", label: "Any capacity" },
  { value: "open", label: "Seats left" },
  { value: "almost", label: "Almost full (80%+)" },
  { value: "full", label: "Sold out" },
];

/** Rebuilds the query string for a page link, keeping the active filters. */
function pageHref(query: EventQuery, page: number) {
  const params = new URLSearchParams();
  if (query.structure && query.structure !== "all") {
    params.set("structure", query.structure);
  }
  if (query.when && query.when !== "upcoming") params.set("when", query.when);
  if (query.seats && query.seats !== "all") params.set("seats", query.seats);
  if (page > 1) params.set("page", String(page));

  const qs = params.toString();
  return qs ? `/events?${qs}` : "/events";
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const pick = (key: string) =>
    Array.isArray(raw[key]) ? raw[key][0] : raw[key];

  const query: EventQuery = {
    structure: pick("structure") ?? "all",
    when: pick("when") ?? "upcoming",
    seats: pick("seats") ?? "all",
    page: pick("page"),
  };

  // One clock for filtering and for labelling, so the two cannot disagree.
  const now = new Date();
  const [tournaments, session] = await Promise.all([
    listTournaments(),
    getSession(),
  ]);
  const allEvents = [...tournaments, ...pastEvents];
  const { items, page, pages, total } = queryEvents(allEvents, query, now);

  const playerId = session.token ? await findPlayerIdByToken(session.token) : null;
  const [signups, savedSlugs] = playerId
    ? await Promise.all([listSignupsForPlayer(playerId), listSavedSlugsForPlayer(playerId)])
    : [new Map<string, string | null>(), []];
  const registered = new Set(signups.keys());
  const saved = new Set(savedSlugs);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <SiteHeader />

      <main className="section" id="main">
        <div className="wrap">
          <p className="tab">Tournaments</p>
          <h1 className="section__title">Events</h1>

          {/* Pinned outside the filtered/paginated list, so it is always the
              first thing on the page regardless of query params. */}
          <div className="featured panel">
            <span className="featured__badge">Hall of Fame</span>
            <div className="featured__body">
              <div className="featured__main">
                <h2 className="featured__name">
                  <Link href={`/events/${FEATURED_EVENT.slug}`}>
                    {FEATURED_EVENT.name}
                  </Link>
                </h2>
                <p className="featured__date">{formatDate(FEATURED_EVENT.date)}</p>
              </div>
              <dl className="featured__stats">
                <div>
                  <dt>Winner</dt>
                  <dd>{FEATURED_EVENT.winner}</dd>
                </div>
                <div>
                  <dt>Community</dt>
                  <dd>{FEATURED_EVENT.community}</dd>
                </div>
                <div>
                  <dt>Players</dt>
                  <dd>{FEATURED_EVENT.players.toLocaleString("en-GB")}</dd>
                </div>
                <div>
                  <dt>Format</dt>
                  <dd>{FEATURED_EVENT.format}</dd>
                </div>
                <div>
                  <dt>Winning deck</dt>
                  <dd>{FEATURED_EVENT.winningDeck}</dd>
                </div>
              </dl>
            </div>
          </div>

          {/* GET form: filters live in the URL, so results are shareable and
              the page works with JavaScript disabled. */}
          <form className="filters panel" method="get">
            <div className="filters__field">
              <label htmlFor="structure">Structure</label>
              <select
                id="structure"
                name="structure"
                defaultValue={query.structure}
              >
                {structureOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="filters__field">
              <label htmlFor="when">Date</label>
              <select id="when" name="when" defaultValue={query.when}>
                {whenOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="filters__field">
              <label htmlFor="seats">Seats</label>
              <select id="seats" name="seats" defaultValue={query.seats}>
                {seatOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="filters__actions">
              <button className="btn btn--solid" type="submit">
                Apply
              </button>
              <Link className="filters__reset" href="/events">
                Reset
              </Link>
            </div>
          </form>

          <p className="filters__count" role="status">
            {total === 0
              ? "No events match these filters."
              : `${total} ${total === 1 ? "event" : "events"} · page ${page} of ${pages}`}
          </p>

          {items.length === 0 ? (
            <div className="empty panel">
              <p className="lede">
                Nothing scheduled under those filters. Try Any date, or clear
                the structure filter.
              </p>
              <Link className="btn" href="/events">
                Clear filters
              </Link>
            </div>
          ) : (
            <ul className="events">
              {items.map((event) => {
                const left = seatsLeft(event);
                const full = left === 0;
                const past = isPast(event, now);
                const almost = !full && fillRatio(event) >= ALMOST_FULL;

                return (
                  <li
                    className={`event panel${past ? " event--past" : ""}`}
                    key={event.slug}
                  >
                    <div className="event__when">
                      <span className="event__date">
                        {formatDate(event.startsAt)}
                      </span>
                      <span className="event__time">
                        {formatTime(event.startsAt)}
                      </span>
                      {past ? (
                        <span className="event__done">Finished</span>
                      ) : null}
                    </div>

                    <div className="event__body">
                      <h2 className="event__name">
                        <Link href={`/events/${event.slug}`}>{event.name}</Link>
                      </h2>
                      <p className="event__meta">
                        <span className="event__tag">
                          {STRUCTURES[event.structure].label}
                        </span>
                        <span>{event.rounds} rounds</span>
                        {event.topCut ? <span>Top {event.topCut}</span> : null}
                        <span>{event.matchFormat}</span>
                        <span>{event.roundLimitDays}-day round deadline</span>
                      </p>
                      <p className="event__host">
                        {event.host} · {formatEntry(event.entry)}
                      </p>
                    </div>

                    <div className="event__signup">
                      {/* A finished event has an attendance, not seats left. */}
                      {past ? (
                        <span className="event__seats">
                          {event.seats === null
                            ? `${event.taken} duelists`
                            : `${event.taken} of ${event.seats} duelists`}
                        </span>
                      ) : (
                        <span
                          className={`event__seats${
                            full
                              ? " event__seats--full"
                              : almost
                                ? " event__seats--almost"
                                : ""
                          }`}
                        >
                          {event.seats === null
                            ? "Unlimited seats"
                            : full
                              ? "Sold out"
                              : `${left} of ${event.seats} seats left`}
                        </span>
                      )}

                      {past ? (
                        <Link
                          className="btn btn--quiet"
                          href={`/events/${event.slug}`}
                        >
                          Results
                        </Link>
                      ) : registered.has(event.slug) ? (
                        <Link
                          className="btn btn--in"
                          href={`/events/${event.slug}/signup`}
                        >
                          You are in
                        </Link>
                      ) : full ? (
                        <span className="btn btn--quiet" aria-disabled="true">
                          Sold out
                        </span>
                      ) : (
                        <Link
                          className="btn btn--solid"
                          href={`/events/${event.slug}/signup`}
                        >
                          Sign up
                        </Link>
                      )}

                      {session.token ? (
                        <form
                          action={
                            saved.has(event.slug)
                              ? unsaveTournamentAction
                              : saveTournamentAction
                          }
                        >
                          <input type="hidden" name="slug" value={event.slug} />
                          <button
                            className={`btn btn--quiet${
                              saved.has(event.slug) ? " btn--in" : ""
                            }`}
                            type="submit"
                          >
                            {saved.has(event.slug) ? "Saved" : "Save"}
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {pages > 1 ? (
            <nav className="pager" aria-label="Pagination">
              {page > 1 ? (
                <Link className="pager__step" href={pageHref(query, page - 1)}>
                  Previous
                </Link>
              ) : (
                <span className="pager__step pager__step--off">Previous</span>
              )}

              <span className="pager__pages">
                {Array.from({ length: pages }, (_, i) => i + 1).map((n) =>
                  n === page ? (
                    <span
                      className="pager__num pager__num--on"
                      key={n}
                      aria-current="page"
                    >
                      {n}
                    </span>
                  ) : (
                    <Link
                      className="pager__num"
                      key={n}
                      href={pageHref(query, n)}
                    >
                      {n}
                    </Link>
                  ),
                )}
              </span>

              {page < pages ? (
                <Link className="pager__step" href={pageHref(query, page + 1)}>
                  Next
                </Link>
              ) : (
                <span className="pager__step pager__step--off">Next</span>
              )}
            </nav>
          ) : null}
        </div>
      </main>
    </>
  );
}
