import type { Metadata } from "next";
import Link from "next/link";
import EventList from "@/components/site/EventList";
import FeaturedEventCard from "@/components/site/FeaturedEventCard";
import Footer from "@/components/site/Footer";
import SiteHeader from "@/components/site/SiteHeader";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Label from "@/components/ui/Label";
import PageHeading from "@/components/ui/PageHeading";
import Pager from "@/components/ui/Pager";
import Select from "@/components/ui/Select";
import Wrap from "@/components/ui/Wrap";
import { getSession } from "@/lib/auth";
import { findPlayerIdByToken } from "@/lib/backend/services/player.service";
import { listSavedSlugsForPlayer, listSignupsForPlayer } from "@/lib/backend/services/registration.service";
import { getPlacings } from "@/lib/backend/services/results.service";
import { isFinished, queryEvents, type EventQuery } from "@/lib/events";
import { listTournaments } from "@/lib/tournaments";
import { saveTournamentAction, unsaveTournamentAction } from "./saved-actions";

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

  // Pinned above the filtered list: whichever tournament finished most
  // recently, so the highlight always reflects a real result, not mock data.
  const featured = tournaments
    .filter(isFinished)
    .sort((a, b) => new Date(b.finishedAt!).getTime() - new Date(a.finishedAt!).getTime())[0] ?? null;
  const featuredWinner = featured
    ? ((await getPlacings(featured.slug)).find((p) => p.place === 1)?.displayName ?? null)
    : null;

  const allEvents = tournaments.filter((t) => t.slug !== featured?.slug);
  const { items, page, pages, total } = queryEvents(allEvents, query, now);

  const playerId = session.token ? await findPlayerIdByToken(session.token) : null;
  const [signups, savedSlugs] = playerId
    ? await Promise.all([listSignupsForPlayer(playerId), listSavedSlugsForPlayer(playerId)])
    : [new Map<string, string | null>(), []];
  const registered = new Set(signups.keys());
  const saved = new Set(savedSlugs);

  return (
    <>
      <SiteHeader />

      <main className="section" id="main">
        <Wrap>
          <PageHeading tab="Tournaments" title="Events" />

          {/* Pinned outside the filtered/paginated list, so it is always the
              first thing on the page regardless of query params. */}
          {featured ? <FeaturedEventCard event={featured} winnerName={featuredWinner} /> : null}

          {/* GET form: filters live in the URL, so results are shareable and
              the page works with JavaScript disabled. */}
          <form className="filters panel" method="get">
            <div className="filters__field">
              <Label htmlFor="structure">Structure</Label>
              <Select id="structure" name="structure" defaultValue={query.structure}>
                {structureOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="filters__field">
              <Label htmlFor="when">Date</Label>
              <Select id="when" name="when" defaultValue={query.when}>
                {whenOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="filters__field">
              <Label htmlFor="seats">Seats</Label>
              <Select id="seats" name="seats" defaultValue={query.seats}>
                {seatOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="filters__actions">
              <Button variant="solid" type="submit">
                Apply
              </Button>
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

          {items.length === 0 && query.structure === "all" && query.when === "upcoming" && query.seats === "all" ? (
            <EmptyState
              message={
                featured
                  ? "No upcoming tournaments right now - check back soon, or see what just wrapped up above."
                  : "No upcoming tournaments right now. Check back soon."
              }
              action={<Button href="/events?when=all">See past events</Button>}
            />
          ) : items.length === 0 ? (
            <EmptyState
              message="Nothing scheduled under those filters. Try Any date, or clear the structure filter."
              action={<Button href="/events">Clear filters</Button>}
            />
          ) : (
            <EventList
              events={items}
              now={now}
              hasSession={!!session.token}
              registered={registered}
              saved={saved}
              saveAction={saveTournamentAction}
              unsaveAction={unsaveTournamentAction}
            />
          )}

          <Pager page={page} pages={pages} hrefFor={(n) => pageHref(query, n)} />
        </Wrap>
      </main>

      <Footer />
    </>
  );
}
