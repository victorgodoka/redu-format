import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import AdminList, { AdminRow } from "@/components/admin/AdminList";
import Bracket from "@/components/site/Bracket";
import EventBanner from "@/components/site/EventBanner";
import EventDescription from "@/components/site/EventDescription";
import Footer from "@/components/site/Footer";
import SiteHeader from "@/components/site/SiteHeader";
import StandingsTable from "@/components/site/StandingsTable";
import TopDeckList, { type StandingsDeck } from "@/components/site/TopDeckList";
import Button from "@/components/ui/Button";
import FactsList from "@/components/ui/FactsList";
import Lede from "@/components/ui/Lede";
import Notice from "@/components/ui/Notice";
import PageHeading from "@/components/ui/PageHeading";
import Tab from "@/components/ui/Tab";
import Wrap from "@/components/ui/Wrap";
import { fetchProfile, getSession } from "@/lib/auth";
import { findPlayerIdByToken } from "@/lib/backend/services/player.service";
import { findMySignup, listSavedSlugsForPlayer } from "@/lib/backend/services/registration.service";
import {
  getMyCurrentMatch,
  getMyMatchHistory,
  getPlacingsForPlayer,
  getPlacingsWithTiebreak,
  type MyMatchHistoryEntry,
  type MyMatchView,
} from "@/lib/backend/services/results.service";
import {
  FEATURED_EVENT,
  formatDate,
  formatEntry,
  formatTime,
  isFinished,
  isPast,
  seatsLeft,
  STRUCTURES,
  type TournamentEvent,
} from "@/lib/events";
import { fetchDeckArt } from "@/lib/nexus-parse";
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
    const description = `Results, bracket and Top 8 decklists from ${FEATURED_EVENT.name}.`;
    return {
      title: `${FEATURED_EVENT.name} | REDU Format`,
      description,
      alternates: { canonical: `/events/${FEATURED_EVENT.slug}` },
      openGraph: {
        type: "website",
        url: `/events/${FEATURED_EVENT.slug}`,
        siteName: "REDU Format",
        title: `${FEATURED_EVENT.name} | REDU Format`,
        description,
      },
    };
  }

  const event = await getTournament(slug);
  if (!event) return {};

  const description = isFinished(event)
    ? `Results and final standings from ${event.name}.`
    : `${STRUCTURES[event.structure].label} tournament on ${formatDate(event.startsAt)}, ${event.seats} seats.`;
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

function SaveToggle({ slug, isSaved }: { slug: string; isSaved: boolean }) {
  return (
    <form action={isSaved ? unsaveTournamentAction : saveTournamentAction}>
      <input type="hidden" name="slug" value={slug} />
      <Button variant="quiet" className={isSaved ? "btn--in" : undefined} type="submit">
        {isSaved ? "Saved" : "Save"}
      </Button>
    </form>
  );
}

function EventFacts({ event, past }: { event: TournamentEvent; past: boolean }) {
  const left = seatsLeft(event);
  return (
    <FactsList
      rows={[
        { label: "Starts", value: `${formatDate(event.startsAt)}, ${formatTime(event.startsAt)}` },
        { label: "Structure", value: STRUCTURES[event.structure].label },
        event.structure === "double-elim"
          ? { label: "Format", value: `${event.matchFormat} · ${event.roundLimitDays}-day deadline` }
          : {
              label: "Rounds",
              value: `${event.rounds} · ${event.matchFormat} · ${event.roundLimitDays}-day round deadline${event.topCut ? ` · Top ${event.topCut}` : ""}`,
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
  );
}

function MatchHistory({ history }: { history: MyMatchHistoryEntry[] }) {
  if (history.length === 0) return null;
  return (
    <Notice>
      <Tab>Your duels</Tab>
      <AdminList>
        {history.map((entry) => (
          <AdminRow key={entry.round}>
            <AdminRow.Main>
              <span className="admin-row__title">
                {entry.roundLabel} · {entry.result === "bye" ? "Bye" : `vs ${entry.opponentName ?? "?"}`}
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
  );
}

/** The permanently pinned historical highlight - not a DB row, so it's rendered from static data instead of going through getTournament(). */
function HallOfFamePage() {
  return (
    <main className="section" id="main">
      <Wrap>
        <PageHeading tab="Hall of Fame" title={FEATURED_EVENT.name} />

        <div className="results-stack">
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

          <div>
            <h2 className="section__subtitle">Bracket</h2>
            <Bracket rounds={YCS_PROVIDENCE_2012_BRACKET} />
          </div>

          <div>
            <h2 className="section__subtitle" id="decklists">
              Top decks
            </h2>
            <TopDeckList decks={YCS_PROVIDENCE_2012_DECKS} />
          </div>
        </div>
      </Wrap>
    </main>
  );
}

/** How many top placements get the full Hall of Fame deck-card treatment, instead of just a line in the standings list. */
const TOP_DECK_LIMIT = 8;

function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** Any tournament with completeBracket() run - results are frozen, so this is a read-only recap, not a live signup/match page. */
async function FeaturedEventPage({
  event,
  registeredDeckName,
  myPlacing,
  myHistory,
  saveAction,
}: {
  event: TournamentEvent;
  registeredDeckName: string | null;
  myPlacing: { place: number; points: number } | undefined;
  myHistory: MyMatchHistoryEntry[];
  saveAction: ReactNode;
}) {
  const placings = await getPlacingsWithTiebreak(event.slug);
  const winner = placings.find((p) => p.place === 1);

  // Fetched live from Dueling Nexus by the deck UUID stored at signup - the
  // player's account may have deleted or hidden the deck since, so a failed
  // fetch still shows the placement, just without art/decklist.
  const topDecks: StandingsDeck[] = await Promise.all(
    placings
      .filter((p) => p.place <= TOP_DECK_LIMIT && p.deckId)
      .map(async (p) => {
        const art = await fetchDeckArt(p.deckId!);
        return {
          id: p.deckId!,
          archetype: p.deckName,
          place: `${ordinal(p.place)} Place`,
          player: p.displayName,
          cover: art?.coverId ?? undefined,
          main: art?.main,
          extra: art?.extra,
          side: art?.side,
          unavailable: art
            ? undefined
            : "This deck is private or doesn't exist anymore. Please contact administration.",
        };
      }),
  );

  return (
    <main className="section" id="main">
      <Wrap>
        <PageHeading tab="Results" title={event.name} action={saveAction} />
        <EventBanner event={event} />
        <EventDescription event={event} />

        <div className="signup">
          <div className="signup__main">
            <Notice variant="done">
              <Tab>{registeredDeckName ? "You played" : "Results"}</Tab>
              <Lede>
                {registeredDeckName
                  ? myPlacing
                    ? `Played ${registeredDeckName} - placed #${myPlacing.place} of ${event.taken}, ${myPlacing.points} pts.`
                    : `You played this event with ${registeredDeckName}. Results for this event have not been finalized yet.`
                  : "This event has finished."}
              </Lede>
            </Notice>

            <MatchHistory history={myHistory} />

            <Notice>
              <Tab>Final standings</Tab>
              <StandingsTable rows={placings} />
            </Notice>
          </div>

          <aside className="signup__side">
            <FactsList
              rows={[
                { label: "Finished", value: formatDate(event.finishedAt ?? event.startsAt) },
                { label: "Structure", value: STRUCTURES[event.structure].label },
                { label: "Players", value: `${event.taken}` },
                { label: "Winner", value: winner?.displayName ?? "—" },
                { label: "Host", value: `${event.host} · ${formatEntry(event.entry)}` },
              ]}
            />
          </aside>
        </div>

        {topDecks.length > 0 ? (
          <div className="results-fullwidth">
            <h2 className="section__subtitle" id="decklists">
              Top decks
            </h2>
            <TopDeckList decks={topDecks} />
          </div>
        ) : null}
      </Wrap>
    </main>
  );
}

/** Started but not finished yet - registration is closed, rounds are being played. */
function OngoingEventPage({
  event,
  registeredDeck,
  myMatch,
  myHistory,
  saveAction,
}: {
  event: TournamentEvent;
  registeredDeck: { name: string; main: number; extra: number; side: number } | undefined;
  myMatch: MyMatchView | null;
  myHistory: MyMatchHistoryEntry[];
  saveAction: ReactNode;
}) {
  return (
    <main className="section" id="main">
      <Wrap>
        <PageHeading tab="Tournament" title={event.name} action={saveAction} />
        <EventBanner event={event} />
        <EventDescription event={event} />

        <div className="signup">
          <div className="signup__main">
            {registeredDeck ? (
              <Notice variant="done">
                <Tab>You played</Tab>
                <h2 className="notice__title">{registeredDeck.name}</h2>
                <Lede>This tournament is underway - check your current match below.</Lede>
              </Notice>
            ) : (
              <Notice>
                <Lede>Registration is closed - this tournament has already started.</Lede>
              </Notice>
            )}

            {myMatch ? (
              <Notice variant={myMatch.phase === "topCut" ? "done" : undefined}>
                <Tab>{myMatch.roundLabel} · Your duel</Tab>
                <h2 className="notice__title">vs {myMatch.opponentName ?? "TBD"}</h2>
                {myMatch.phase === "topCut" ? (
                  <Lede>You made Top Cut - this is single elimination from here, no more Swiss cushion.</Lede>
                ) : null}
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
                    You and your opponent reported different results - a staff member will step in to
                    sort it out.
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
                  <input type="hidden" name="slug" value={event.slug} />
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

            <MatchHistory history={myHistory} />
          </div>

          <aside className="signup__side">
            <EventFacts event={event} past />
          </aside>
        </div>
      </Wrap>
    </main>
  );
}

/** Not started yet - the signup/save-the-date view. */
function UpcomingEventPage({
  event,
  registeredDeck,
  paymentStatus,
  saveAction,
}: {
  event: TournamentEvent;
  registeredDeck: { name: string; main: number; extra: number; side: number } | undefined;
  paymentStatus: "pending" | "confirmed" | "contested" | "not_required" | null;
  saveAction: ReactNode;
}) {
  const left = seatsLeft(event);
  const paymentDue = event.entry.type === "paid" && paymentStatus && paymentStatus !== "confirmed";

  return (
    <main className="section" id="main">
      <Wrap>
        <PageHeading tab="Tournament" title={event.name} action={saveAction} />
        <EventBanner event={event} />
        <EventDescription event={event} />

        <div className="signup">
          <div className="signup__main">
            {registeredDeck ? (
              <Notice variant="done">
                <Tab>Registered</Tab>
                <h2 className="notice__title">{registeredDeck.name}</h2>
                <Lede>
                  {registeredDeck.main} main · {registeredDeck.extra} extra · {registeredDeck.side} side.
                  Bring it to {formatDate(event.startsAt)} at {formatTime(event.startsAt)}.
                </Lede>
                {paymentDue ? (
                  <p className="payment-status">
                    <span className={`badge ${paymentStatus === "contested" ? "badge--negative" : "badge--neutral"}`}>
                      {paymentStatus === "contested" ? "Payment contested" : "Payment pending"}
                    </span>
                    {formatEntry(event.entry)} still owed - submit your proof from the registration page.
                  </p>
                ) : null}
                <Link className="btn" href={`/events/${event.slug}/signup`}>
                  Manage registration
                </Link>
              </Notice>
            ) : (
              <Notice>
                <Lede>
                  {left === 0
                    ? "Every seat is taken."
                    : "You are not registered for this event yet."}
                </Lede>
                {left === 0 ? null : (
                  <Link className="btn btn--solid" href={`/events/${event.slug}/signup`}>
                    Sign up
                  </Link>
                )}
              </Notice>
            )}
          </div>

          <aside className="signup__side">
            <EventFacts event={event} past={false} />
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

  if (slug === FEATURED_EVENT.slug) {
    return (
      <>
        <SiteHeader />
        <HallOfFamePage />
        <Footer />
      </>
    );
  }

  const event = await getTournament(slug);
  if (!event) notFound();

  const session = await getSession();
  const playerId = session.token ? await findPlayerIdByToken(session.token) : null;
  const [profile, signup, savedSlugs, placings] = await Promise.all([
    session.token ? fetchProfile(session.token) : null,
    playerId ? findMySignup(slug, playerId) : null,
    playerId ? listSavedSlugsForPlayer(playerId) : Promise.resolve<string[]>([]),
    playerId ? getPlacingsForPlayer(playerId) : Promise.resolve(new Map<string, { place: number; points: number }>()),
  ]);
  const registeredDeck = profile?.decks.find((d) => d.id === signup?.deckId);
  const myRegistrationId = signup?.registrationId ?? null;
  const isSaved = savedSlugs.includes(slug);
  const saveAction = session.token ? <SaveToggle slug={slug} isSaved={isSaved} /> : undefined;

  const finished = isFinished(event);
  const past = isPast(event, new Date());

  const myMatch = !finished && myRegistrationId ? await getMyCurrentMatch(slug, myRegistrationId) : null;
  const myHistory = myRegistrationId && (finished || past) ? await getMyMatchHistory(slug, myRegistrationId) : [];

  return (
    <>
      <SiteHeader />

      {finished ? (
        <FeaturedEventPage
          event={event}
          registeredDeckName={registeredDeck?.name ?? null}
          myPlacing={placings.get(slug)}
          myHistory={myHistory}
          saveAction={saveAction}
        />
      ) : past ? (
        <OngoingEventPage
          event={event}
          registeredDeck={registeredDeck}
          myMatch={myMatch}
          myHistory={myHistory}
          saveAction={saveAction}
        />
      ) : (
        <UpcomingEventPage
          event={event}
          registeredDeck={registeredDeck}
          paymentStatus={signup?.paymentStatus ?? null}
          saveAction={saveAction}
        />
      )}

      <Footer />
    </>
  );
}
