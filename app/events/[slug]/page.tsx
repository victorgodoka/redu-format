import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AdminList, { AdminRow } from "@/components/admin/AdminList";
import Bracket from "@/components/site/Bracket";
import Footer from "@/components/site/Footer";
import SiteHeader from "@/components/site/SiteHeader";
import TopDeckList from "@/components/site/TopDeckList";
import Button from "@/components/ui/Button";
import FactsList from "@/components/ui/FactsList";
import Lede from "@/components/ui/Lede";
import Notice from "@/components/ui/Notice";
import PageHeading from "@/components/ui/PageHeading";
import Tab from "@/components/ui/Tab";
import Wrap from "@/components/ui/Wrap";
import { fetchProfile, getSession } from "@/lib/auth";
import { findPlayerIdByToken } from "@/lib/backend/services/player.service";
import {
  findMyRegistrationId,
  findSignupDeckId,
  listSavedSlugsForPlayer,
} from "@/lib/backend/services/registration.service";
import { getMyCurrentMatch, getMyMatchHistory, getPlacingsForPlayer } from "@/lib/backend/services/results.service";
import {
  FEATURED_EVENT,
  formatDate,
  formatEntry,
  formatTime,
  isFinished,
  isPast,
  pastEvents,
  seatsLeft,
  STRUCTURES,
} from "@/lib/events";
import { getTournament } from "@/lib/tournaments";
import { YCS_PROVIDENCE_2012_BRACKET, YCS_PROVIDENCE_2012_DECKS } from "@/lib/ycs-providence-2012";
import { saveTournamentAction, unsaveTournamentAction } from "../saved-actions";
import { submitMatchReportAction } from "./report-actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  if (slug === FEATURED_EVENT.slug) {
    return {
      title: `${FEATURED_EVENT.name} | REDU Format`,
      description: `Results, bracket and Top 8 decklists from ${FEATURED_EVENT.name}.`,
      alternates: { canonical: `/events/${FEATURED_EVENT.slug}` },
      openGraph: {
        type: "website",
        url: `/events/${FEATURED_EVENT.slug}`,
        siteName: "REDU Format",
        title: `${FEATURED_EVENT.name} | REDU Format`,
        description: `Results, bracket and Top 8 decklists from ${FEATURED_EVENT.name}.`,
      },
    };
  }

  const event = (await getTournament(slug)) ?? pastEvents.find((e) => e.slug === slug);
  if (!event) return {};

  const description = `${STRUCTURES[event.structure].label} tournament on ${formatDate(event.startsAt)}, ${event.seats} seats.`;
  return {
    title: `${event.name} | REDU Format`,
    description,
    alternates: { canonical: `/events/${slug}` },
    openGraph: {
      type: "website",
      url: `/events/${slug}`,
      siteName: "REDU Format",
      title: `${event.name} | REDU Format`,
      description,
    },
  };
}

function FeaturedEventPage() {
  return (
    <main className="section" id="main">
      <Wrap>
        <PageHeading tab="Hall of Fame" title={FEATURED_EVENT.name} />

        <FactsList
          rows={[
            { label: "Date", value: formatDate(FEATURED_EVENT.date) },
            { label: "Winner", value: FEATURED_EVENT.winner },
            { label: "Community", value: FEATURED_EVENT.community },
            { label: "Players", value: FEATURED_EVENT.players.toLocaleString("en-GB") },
            { label: "Format", value: FEATURED_EVENT.format },
            { label: "Winning deck", value: FEATURED_EVENT.winningDeck },
          ]}
        />

        <h2 className="section__subtitle">Bracket</h2>
        <Bracket rounds={YCS_PROVIDENCE_2012_BRACKET} />

        <h2 className="section__subtitle" id="decklists">
          Top decks
        </h2>
        <TopDeckList decks={YCS_PROVIDENCE_2012_DECKS} />
      </Wrap>
    </main>
  );
}

async function GenericEventPage({ slug }: { slug: string }) {
  const event = (await getTournament(slug)) ?? pastEvents.find((e) => e.slug === slug);
  if (!event) notFound();

  const session = await getSession();
  const playerId = session.token ? await findPlayerIdByToken(session.token) : null;
  const [profile, registeredId, myRegistrationId, savedSlugs, placings] = await Promise.all([
    session.token ? fetchProfile(session.token) : null,
    playerId ? findSignupDeckId(slug, playerId) : null,
    playerId ? findMyRegistrationId(slug, playerId) : null,
    playerId ? listSavedSlugsForPlayer(playerId) : Promise.resolve<string[]>([]),
    playerId ? getPlacingsForPlayer(playerId) : Promise.resolve(new Map<string, { place: number; points: number }>()),
  ]);
  const registeredDeck = profile?.decks.find((d) => d.id === registeredId);
  const placing = placings.get(slug);
  const myMatch = myRegistrationId ? await getMyCurrentMatch(slug, myRegistrationId) : null;
  const myHistory = myRegistrationId ? await getMyMatchHistory(slug, myRegistrationId) : [];

  const now = new Date();
  const past = isPast(event, now);
  const finished = isFinished(event);
  const left = seatsLeft(event);
  const isSaved = savedSlugs.includes(slug);

  return (
    <main className="section" id="main">
      <Wrap>
        <PageHeading
          tab={finished ? "Results" : "Tournament"}
          title={event.name}
          action={
            session.token ? (
              <form action={isSaved ? unsaveTournamentAction : saveTournamentAction}>
                <input type="hidden" name="slug" value={slug} />
                <Button variant="quiet" className={isSaved ? "btn--in" : undefined} type="submit">
                  {isSaved ? "Saved" : "Save"}
                </Button>
              </form>
            ) : undefined
          }
        />

        <div className="signup">
          <div className="signup__main">
            {registeredDeck ? (
              <Notice variant="done">
                <Tab>{finished ? "You played" : "Registered"}</Tab>
                <h2 className="notice__title">{registeredDeck.name}</h2>
                {finished ? (
                  <Lede>
                    {placing
                      ? `Placed #${placing.place} of ${event.taken}, ${placing.points} pts.`
                      : "Results for this event have not been finalized yet."}
                  </Lede>
                ) : past ? (
                  <Lede>This tournament is underway - check your current match below.</Lede>
                ) : (
                  <Lede>
                    {registeredDeck.main} main · {registeredDeck.extra} extra ·{" "}
                    {registeredDeck.side} side. Bring it to {formatDate(event.startsAt)} at{" "}
                    {formatTime(event.startsAt)}.
                  </Lede>
                )}
                {finished ? null : (
                  <Link className="btn" href={`/events/${slug}/signup`}>
                    Manage registration
                  </Link>
                )}
              </Notice>
            ) : (
              <Notice>
                <Lede>
                  {finished
                    ? "This event has finished."
                    : past
                      ? "Registration is closed - this tournament has already started."
                      : left === 0
                        ? "Every seat is taken."
                        : "You are not registered for this event yet."}
                </Lede>
                {past || left === 0 ? null : (
                  <Link className="btn btn--solid" href={`/events/${slug}/signup`}>
                    Sign up
                  </Link>
                )}
              </Notice>
            )}

            {myMatch ? (
              <Notice>
                <Tab>
                  Round {myMatch.round} · Your duel
                </Tab>
                <h2 className="notice__title">vs {myMatch.opponentName ?? "TBD"}</h2>
                {myMatch.deadlineAt ? (
                  <Lede>
                    Round closes {formatDate(myMatch.deadlineAt)} at {formatTime(myMatch.deadlineAt)}.
                  </Lede>
                ) : null}
                {myMatch.roomHash ? (
                  <a
                    className="btn btn--solid"
                    href={`https://duelingnexus.com/duel/NA-${myMatch.roomHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open the duel room
                  </a>
                ) : null}
                {myMatch.disputed ? (
                  <Lede>
                    You and your opponent reported different results - a staff member will step
                    in to sort it out.
                  </Lede>
                ) : myMatch.myReport ? (
                  <Lede>
                    You reported <b>{myMatch.myReport}</b>.{" "}
                    {myMatch.opponentReported
                      ? "Reconciling with your opponent's report."
                      : "Waiting on your opponent to report too."}
                  </Lede>
                ) : (
                  <Lede>Report your result once the duel is over.</Lede>
                )}
                <form action={submitMatchReportAction} className="admin-row__actions">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="matchId" value={myMatch.matchId} />
                  <Button variant="solid" type="submit" name="result" value="win">
                    I won
                  </Button>
                  <Button type="submit" name="result" value="loss">
                    I lost
                  </Button>
                  <Button variant="quiet" type="submit" name="result" value="draw">
                    Draw
                  </Button>
                </form>
              </Notice>
            ) : null}

            {myHistory.length > 0 ? (
              <Notice>
                <Tab>Your duels</Tab>
                <AdminList>
                  {myHistory.map((entry) => (
                    <AdminRow key={entry.round}>
                      <AdminRow.Main>
                        <span className="admin-row__title">
                          Round {entry.round} ·{" "}
                          {entry.result === "bye" ? "Bye" : `vs ${entry.opponentName ?? "?"}`}
                        </span>
                        <span className="admin-row__meta">
                          {entry.result === "bye"
                            ? "Automatic win"
                            : `${entry.result === "win" ? "Won" : entry.result === "loss" ? "Lost" : "Drew"} ${entry.score}`}
                        </span>
                      </AdminRow.Main>
                    </AdminRow>
                  ))}
                </AdminList>
              </Notice>
            ) : null}
          </div>

          <aside className="signup__side">
            <FactsList
              rows={[
                { label: "Starts", value: `${formatDate(event.startsAt)}, ${formatTime(event.startsAt)}` },
                { label: "Structure", value: STRUCTURES[event.structure].label },
                {
                  label: "Rounds",
                  value: `${event.rounds} · ${event.matchFormat} · ${event.roundLimitDays}-day round deadline${
                    event.topCut ? ` · Top ${event.topCut}` : ""
                  }`,
                },
                {
                  label: "Seats",
                  value:
                    event.seats === null
                      ? `${event.taken} registered (unlimited)`
                      : past
                        ? `${event.taken} of ${event.seats} duelists`
                        : `${left} of ${event.seats} left`,
                },
                { label: "Host", value: `${event.host} · ${formatEntry(event.entry)}` },
              ]}
            />
          </aside>
        </div>
      </Wrap>
    </main>
  );
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <>
      <SiteHeader />

      {slug === FEATURED_EVENT.slug ? <FeaturedEventPage /> : <GenericEventPage slug={slug} />}

      <Footer />
    </>
  );
}
