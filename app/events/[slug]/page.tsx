import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import AdminList, { AdminRow } from "@/components/admin/AdminList";
import Bracket from "@/components/site/Bracket";
import EventBanner from "@/components/site/EventBanner";
import MyRound from "@/components/site/MyRound";
import ParticipantsPanel from "@/components/site/ParticipantsPanel";
import TournamentBracket from "@/components/site/TournamentBracket";
import EventDescription from "@/components/site/EventDescription";
import Footer from "@/components/site/Footer";
import SiteHeader from "@/components/site/SiteHeader";
import StandingsTable from "@/components/site/StandingsTable";
import TopDeckList, { type StandingsDeck } from "@/components/site/TopDeckList";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import FactsList from "@/components/ui/FactsList";
import Lede from "@/components/ui/Lede";
import Notice from "@/components/ui/Notice";
import PageHeading from "@/components/ui/PageHeading";
import Tab from "@/components/ui/Tab";
import Wrap from "@/components/ui/Wrap";
import { fetchProfile, getSession } from "@/lib/auth";
import { findPlayerIdByToken } from "@/lib/backend/services/player.service";
import {
  findMySignup,
  findMySignupRecord,
  listSavedSlugsForPlayer,
} from "@/lib/backend/services/registration.service";
import {
  closeOverdueMatches,
  eliminatedRegistrationIds,
  getBracketView,
  getMyMatchHistory,
  getMyRound,
  getPlacingsForPlayer,
  getPlacingsWithTiebreak,
  type BracketView,
  type MyMatchHistoryEntry,
  type MyRoundView,
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
import { TO_DISCORD_URL } from "@/lib/site";
import { getTournament, listPublicParticipants, type PublicParticipant } from "@/lib/tournaments";
import { YCS_PROVIDENCE_2012_BRACKET, YCS_PROVIDENCE_2012_DECKS } from "@/lib/ycs-providence-2012";
import { saveTournamentAction, unsaveTournamentAction } from "../saved-actions";

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

/**
 * Round timer/lock state, straight off the persisted deadlines - the same
 * numbers the server enforces. An elimination bracket has no lockstep round to
 * report on: it advances one match at a time, so it gets a count of what is
 * still being played instead of a round clock.
 */
function RoundStatus({ view }: { view: BracketView }) {
  const { clock } = view;
  const bracketFormat = view.format !== "swiss" || view.status === "stage-two";

  if (bracketFormat) {
    const open = view.matches.filter((m) => m.active && !m.bye).length;
    return (
      <Notice>
        <Tab>Bracket</Tab>
        <Lede>
          {open === 0
            ? "Every match on the board is settled - the next ones open as the bracket resolves."
            : `${open} match${open === 1 ? "" : "es"} being played right now. Each one runs on its own clock; the next match opens as soon as both its players are decided.`}
        </Lede>
      </Notice>
    );
  }

  return (
    <Notice>
      <Tab>Round {view.round}</Tab>
      <Lede>
        {clock.locked
          ? clock.awaitingModerator
            ? "Round locked - waiting for a Tournament Organizer to start the next one."
            : "Round locked - reporting is closed."
          : clock.deadlineAt
            ? `Reporting closes ${formatDate(clock.deadlineAt)} at ${formatTime(clock.deadlineAt)}.`
            : "Round in progress."}
      </Lede>
      {clock.locked && clock.nextRoundAt ? (
        <Lede>
          Next round starts {formatDate(clock.nextRoundAt)} at {formatTime(clock.nextRoundAt)}.
        </Lede>
      ) : null}
    </Notice>
  );
}

/** Registered field, full width, below the bracket-level sections it belongs with. */
function ParticipantsSection({ participants }: { participants: PublicParticipant[] }) {
  return (
    <div className="results-fullwidth">
      <h2 className="section__subtitle" id="participants">
        Registered duelists ({participants.length})
      </h2>
      <ParticipantsPanel participants={participants} />
    </div>
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
  participants,
  view,
  saveAction,
}: {
  event: TournamentEvent;
  registeredDeckName: string | null;
  myPlacing: { place: number; points: number } | undefined;
  myHistory: MyMatchHistoryEntry[];
  participants: PublicParticipant[];
  view: BracketView | null;
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

        {/* Left: what this tournament was. Right: how it ended, then the rest
            of the facts. Bracket, field and decklists go full width below. */}
        <div className="signup">
          <div className="signup__main">
            <EventDescription event={event} />

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
          </div>

          <aside className="signup__side">
            <Notice>
              <Tab>Final ranking</Tab>
              <StandingsTable rows={placings} />
            </Notice>

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

        {view ? (
          <div className="results-fullwidth">
            <h2 className="section__subtitle" id="bracket">
              {view.topCutFormat ? "Top Cut" : "Bracket"}
            </h2>
            <TournamentBracket view={view} />
          </div>
        ) : null}

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
  myRound,
  myHistory,
  participants,
  view,
  disqualified,
  saveAction,
}: {
  event: TournamentEvent;
  registeredDeck: { name: string; main: number; extra: number; side: number } | undefined;
  myRound: MyRoundView | null;
  myHistory: MyMatchHistoryEntry[];
  participants: PublicParticipant[];
  view: BracketView | null;
  /** This visitor's own disqualification reason, if they have one - the page must say so plainly, not just grey out the controls. */
  disqualified: string | null;
  saveAction: ReactNode;
}) {
  return (
    <main className="section" id="main">
      <Wrap>
        <PageHeading tab="Tournament" title={event.name} action={saveAction} />
        <EventBanner event={event} />

        {/* Left: the tournament itself. Right: registration first, then the
            facts. Bracket, field and decks go full width underneath. */}
        <div className="signup">
          <div className="signup__main">
            <EventDescription event={event} />

            {disqualified ? (
              <Notice variant="warn">
                <Tab>Disqualified</Tab>
                <h2 className="notice__title">You are out of this tournament</h2>
                <Lede>
                  {disqualified}
                </Lede>
                <Lede>
                  Decks are frozen for the whole event, so this was applied automatically and takes
                  effect immediately. Contact a Tournament Organizer if you believe it is a mistake.
                </Lede>
                <a
                  className="btn btn--solid"
                  href={TO_DISCORD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Contact a Tournament Organizer
                </a>
              </Notice>
            ) : null}

            {myRound && !disqualified ? <MyRound slug={event.slug} round={myRound} /> : null}

            <MatchHistory history={myHistory} />
          </div>

          <aside className="signup__side">
            {registeredDeck ? (
              <Notice variant="done">
                <Tab>Your registration</Tab>
                <h2 className="notice__title">{registeredDeck.name}</h2>
                <Lede>
                  This tournament is underway, and your deck is locked to the list it held when it
                  started.
                </Lede>
              </Notice>
            ) : (
              <Notice>
                <Tab>Signup</Tab>
                <Lede>Registration is closed - this tournament has already started.</Lede>
              </Notice>
            )}

            {view ? <RoundStatus view={view} /> : null}

            <EventFacts event={event} past />
          </aside>
        </div>

        {view ? (
          <div className="results-fullwidth">
            <h2 className="section__subtitle" id="bracket">
              Bracket
            </h2>
            <TournamentBracket view={view} />
          </div>
        ) : null}

        <div className="results-fullwidth">
          <h2 className="section__subtitle" id="decklists">
            Top decks
          </h2>
          <EmptyState message="Decklists are published once the tournament finishes - decks stay hidden while rounds are still being played." />
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
  participants,
  saveAction,
}: {
  event: TournamentEvent;
  registeredDeck: { name: string; main: number; extra: number; side: number } | undefined;
  paymentStatus: "pending" | "confirmed" | "contested" | "not_required" | null;
  participants: PublicParticipant[];
  saveAction: ReactNode;
}) {
  const left = seatsLeft(event);
  const paymentDue = event.entry.type === "paid" && paymentStatus && paymentStatus !== "confirmed";

  return (
    <main className="section" id="main">
      <Wrap>
        <PageHeading tab="Tournament" title={event.name} action={saveAction} />
        <EventBanner event={event} />

        <div className="signup">
          <div className="signup__main">
            <EventDescription event={event} />
          </div>

          <aside className="signup__side">
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

            <EventFacts event={event} past={false} />
          </aside>
        </div>

        <ParticipantsSection participants={participants} />
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
  const [profile, signup, signupRecord, savedSlugs, placings] = await Promise.all([
    session.token ? fetchProfile(session.token) : null,
    playerId ? findMySignup(slug, playerId) : null,
    // Reads the registration even after a drop or a disqualification, which is
    // exactly when the player most needs the page to explain itself.
    playerId ? findMySignupRecord(slug, playerId) : null,
    playerId ? listSavedSlugsForPlayer(playerId) : Promise.resolve<string[]>([]),
    playerId ? getPlacingsForPlayer(playerId) : Promise.resolve(new Map<string, { place: number; points: number }>()),
  ]);
  const registeredDeck = profile?.decks.find((d) => d.id === signup?.deckId);
  const myRegistrationId = signup?.registrationId ?? signupRecord?.registrationId ?? null;
  const isSaved = savedSlugs.includes(slug);
  const saveAction = session.token ? <SaveToggle slug={slug} isSaved={isSaved} /> : undefined;

  const finished = isFinished(event);
  const past = isPast(event, new Date());

  // Round transitions are driven by persisted deadlines, not by anyone's open
  // tab - but settling them on a visit keeps a locked round from lingering
  // past its cleanup window between cron sweeps. It runs after the response:
  // a write in the middle of a render makes the two renders of this page
  // disagree, and the round lock this page displays comes from the timestamps
  // either way.
  if (event.status === "running") after(() => closeOverdueMatches(slug).catch(() => null));

  const view = past || finished ? await getBracketView(slug) : null;
  const participants = await listPublicParticipants(
    slug,
    view ? eliminatedRegistrationIds(view) : undefined,
  );
  const disqualified = signupRecord?.disqualifiedAt
    ? (signupRecord.dqReason ??
      "Your deck no longer matches the list locked in when this tournament started.")
    : null;

  const myRound = !finished && myRegistrationId ? await getMyRound(slug, myRegistrationId) : null;
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
          participants={participants}
          view={view}
          saveAction={saveAction}
        />
      ) : past ? (
        <OngoingEventPage
          event={event}
          registeredDeck={registeredDeck}
          myRound={myRound}
          myHistory={myHistory}
          participants={participants}
          view={view}
          disqualified={disqualified}
          saveAction={saveAction}
        />
      ) : (
        <UpcomingEventPage
          event={event}
          registeredDeck={registeredDeck}
          paymentStatus={signup?.paymentStatus ?? null}
          participants={participants}
          saveAction={saveAction}
        />
      )}

      <Footer />
    </>
  );
}
