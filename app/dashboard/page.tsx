import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { after } from "next/server";
import AdminList, { AdminRow } from "@/components/admin/AdminList";
import StatBar from "@/components/admin/StatBar";
import DeckList from "@/components/site/DeckList";
import MyRound from "@/components/site/MyRound";
import Footer from "@/components/site/Footer";
import SiteHeader from "@/components/site/SiteHeader";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import FallbackImage from "@/components/ui/FallbackImage";
import Tab from "@/components/ui/Tab";
import Wrap from "@/components/ui/Wrap";
import { deckLegality, fetchProfile, getSession } from "@/lib/auth";
import { findPlayerIdByToken } from "@/lib/backend/services/player.service";
import {
  findMyRegistrationId,
  listSavedSlugsForPlayer,
  listSignupsForPlayer,
} from "@/lib/backend/services/registration.service";
import { verifyTournament } from "@/lib/backend/services/duel-verification.service";
import { getRedoStatus } from "@/lib/backend/services/redo.service";
import { closeOverdueMatches, getMyRound, getPlacingsForPlayer } from "@/lib/backend/services/results.service";
import { Card } from "@/lib/cards";
import { DEFAULT_AVATAR } from "@/lib/nexus-parse";
import { formatDate, formatTime, isPast } from "@/lib/events";
import { listTournaments } from "@/lib/tournaments";
import { validateDecks } from "@/lib/validateDecks";
import { unsaveTournamentAction } from "../events/saved-actions";
import { logout, refresh } from "../login/actions";

export const metadata: Metadata = {
  title: "Dashboard | REDU Format",
  robots: { index: false, follow: false },
};

const EDITOR = "https://duelingnexus.com/editor";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session.token) redirect("/login");

  const [profile, tournaments] = await Promise.all([
    fetchProfile(session.token),
    listTournaments(),
  ]);

  // A revoked token fails here rather than at login. Hand off to the logout
  // route, which is allowed to clear the cookie; clearing it during this render
  // would throw, and leaving it would bounce between /login and /dashboard.
  if (!profile) redirect("/api/auth/logout");

  // REDU-legal decks surface first, with their own visual treatment, so a
  // duelist with many decks does not have to hunt for the playable ones.
  const validatedLists = validateDecks(profile.deckLists);
  const deckRows = profile.decks
    .map((deck) => {
      const list = validatedLists.find((d) => d.id === deck.id);
      const legal = !deckLegality(deck) && (list?.valid ?? false);
      // The cover can be an errata id; its original passcode is the fallback
      // art if the CDN never mirrored that specific print.
      const coverFallbackId = deck.coverId !== null ? new Card(deck.coverId).id : null;
      return { deck, legal, coverFallbackId };
    })
    .sort((a, b) => Number(b.legal) - Number(a.legal));
  const legalDeckCount = deckRows.filter((row) => row.legal).length;

  const allEvents = tournaments;
  const now = new Date();

  const playerId = await findPlayerIdByToken(session.token);
  const [signups, savedSlugs, placings] = playerId
    ? await Promise.all([
        listSignupsForPlayer(playerId),
        listSavedSlugsForPlayer(playerId),
        getPlacingsForPlayer(playerId),
      ])
    : [new Map<string, string | null>(), [], new Map<string, { place: number; points: number }>()];

  const yourEvents = [...signups.entries()]
    .map(([slug, deckId]) => {
      const event = allEvents.find((e) => e.slug === slug);
      if (!event) return null;
      return {
        event,
        deck: profile.decks.find((d) => d.id === deckId),
        past: isPast(event, now),
      };
    })
    .filter((e) => e !== null);
  const upcomingEvents = yourEvents
    .filter((e) => !e.past)
    .sort(
      (a, b) => new Date(a.event.startsAt).getTime() - new Date(b.event.startsAt).getTime(),
    );
  const pastYourEvents = yourEvents
    .filter((e) => e.past)
    .sort(
      (a, b) => new Date(b.event.startsAt).getTime() - new Date(a.event.startsAt).getTime(),
    );

  /**
   * Reporting has to be reachable from here, not only from the tournament
   * page: these are the rounds the player actually has open right now, with
   * the same card (report buttons, bye, waiting, locked) the event page uses.
   * A round whose timer already ran out reads as locked here regardless: the
   * lock comes from the persisted deadline, not from the sweep.
   */
  const liveRounds = playerId
    ? (
        await Promise.all(
          yourEvents
            .filter(({ event }) => event.status === "running")
            .map(async ({ event }) => {
              // Settled after the response, never during the render - see the
              // event page for why a mid-render write breaks hydration.
              after(() => closeOverdueMatches(event.slug).catch(() => null));
              after(() => verifyTournament(event.slug).catch(() => null));
              const registrationId = await findMyRegistrationId(event.slug, playerId);
              const round = registrationId ? await getMyRound(event.slug, registrationId) : null;
              const redo = round?.match && registrationId ? await getRedoStatus(event.slug, round.match.matchId, registrationId) : null;
              return round ? { event, round, redo } : null;
            }),
        )
      ).filter((r) => r !== null)
    : [];

  const savedEvents = savedSlugs
    .map((slug) => allEvents.find((e) => e.slug === slug))
    .filter((e) => e !== undefined)
    .map((event) => ({ event, past: isPast(event, now) }));
  const savedUpcoming = savedEvents
    .filter((e) => !e.past)
    .sort(
      (a, b) => new Date(a.event.startsAt).getTime() - new Date(b.event.startsAt).getTime(),
    );
  const savedPast = savedEvents
    .filter((e) => e.past)
    .sort(
      (a, b) => new Date(b.event.startsAt).getTime() - new Date(a.event.startsAt).getTime(),
    );

  return (
    <>
      <SiteHeader />

      <main className="section" id="main">
        <Wrap>
          <Tab>Dashboard</Tab>

          <div className="profile">
            {profile.avatar ? (
              <FallbackImage
                key={profile.avatar}
                className="profile__avatar"
                src={profile.avatar}
                fallbackSrc={DEFAULT_AVATAR}
                alt=""
                width={72}
                height={72}
              />
            ) : null}
            <div>
              <h1 className="profile__name">{profile.name}</h1>
              <p className="profile__meta">
                {profile.decks.length}{" "}
                {profile.decks.length === 1 ? "deck" : "decks"} on Dueling Nexus
                {profile.contributor ? " · Contributor" : ""}
              </p>
            </div>
            <div className="profile__out">
              <form action={refresh}>
                <Button type="submit">Refresh</Button>
              </form>
              <form action={logout}>
                <Button type="submit">Sign out</Button>
              </form>
            </div>
          </div>

          <StatBar
            stats={[
              { label: "Decks", value: profile.decks.length },
              { label: "REDU legal", value: legalDeckCount },
              { label: "Upcoming signups", value: upcomingEvents.length },
            ]}
            actions={
              <>
                <Button variant="solid" href="/events">
                  Browse events
                </Button>
                <a className="btn" href={EDITOR} target="_blank" rel="noopener noreferrer">
                  Deck editor
                </a>
              </>
            }
          />

          {liveRounds.length > 0 ? (
            <>
              <h2 className="section__subtitle">Your current rounds</h2>
              <div className="dashboard-rounds">
                {liveRounds.map(({ event, round, redo }) => (
                  <MyRound
                    key={event.slug}
                    slug={event.slug}
                    round={round}
                    redo={redo}
                    eventName={event.name}
                    href={`/events/${event.slug}`}
                  />
                ))}
              </div>
            </>
          ) : null}

          <div className="section__grid">
            <div className="section__content">
              {yourEvents.length > 0 ? (
                <>
                  <h2 className="section__subtitle">Your events</h2>

                  {upcomingEvents.length > 0 ? (
                    <AdminList>
                      {upcomingEvents.map(({ event, deck }) => (
                        <AdminRow key={event.slug}>
                          <AdminRow.Main>
                            <span className="admin-row__title">{event.name}</span>
                            <span className="admin-row__meta">
                              {formatDate(event.startsAt)} · {formatTime(event.startsAt)}
                              {deck ? ` · ${deck.name}` : ""}
                            </span>
                          </AdminRow.Main>
                          <AdminRow.Actions>
                            <Link className="btn" href={`/events/${event.slug}`}>
                              View event
                            </Link>
                          </AdminRow.Actions>
                        </AdminRow>
                      ))}
                    </AdminList>
                  ) : null}

                  {pastYourEvents.length > 0 ? (
                    <AdminList>
                      {pastYourEvents.map(({ event, deck }) => {
                        const placing = placings.get(event.slug);
                        return (
                          <AdminRow key={event.slug}>
                            <AdminRow.Main>
                              <span className="admin-row__title">{event.name}</span>
                              <span className="admin-row__meta">
                                {formatDate(event.startsAt)}
                                {deck ? ` · ${deck.name}` : ""}
                                {placing ? ` · Placed #${placing.place}` : ""}
                              </span>
                            </AdminRow.Main>
                            <AdminRow.Actions>
                              <Link className="btn" href={`/events/${event.slug}`}>
                                View results
                              </Link>
                            </AdminRow.Actions>
                          </AdminRow>
                        );
                      })}
                    </AdminList>
                  ) : null}
                </>
              ) : null}
            </div>

            <div className="section__content">
              {savedEvents.length > 0 ? (
                <>
                  <h2 className="section__subtitle">Saved tournaments</h2>

                  {savedUpcoming.length > 0 ? (
                    <AdminList>
                      {savedUpcoming.map(({ event }) => (
                        <AdminRow key={event.slug}>
                          <AdminRow.Main>
                            <span className="admin-row__title">{event.name}</span>
                            <span className="admin-row__meta">
                              {formatDate(event.startsAt)} · {formatTime(event.startsAt)}
                            </span>
                          </AdminRow.Main>
                          <AdminRow.Actions>
                            <Link className="btn" href={`/events/${event.slug}`}>
                              View event
                            </Link>
                            <form action={unsaveTournamentAction}>
                              <input type="hidden" name="slug" value={event.slug} />
                              <Button variant="quiet" type="submit">
                                Unsave
                              </Button>
                            </form>
                          </AdminRow.Actions>
                        </AdminRow>
                      ))}
                    </AdminList>
                  ) : null}

                  {savedPast.length > 0 ? (
                    <AdminList>
                      {savedPast.map(({ event }) => (
                        <AdminRow key={event.slug}>
                          <AdminRow.Main>
                            <span className="admin-row__title">{event.name}</span>
                            <span className="admin-row__meta">
                              {formatDate(event.startsAt)} · Finished
                            </span>
                          </AdminRow.Main>
                          <AdminRow.Actions>
                            <Link className="btn" href={`/events/${event.slug}`}>
                              View results
                            </Link>
                            <form action={unsaveTournamentAction}>
                              <input type="hidden" name="slug" value={event.slug} />
                              <Button variant="quiet" type="submit">
                                Unsave
                              </Button>
                            </form>
                          </AdminRow.Actions>
                        </AdminRow>
                      ))}
                    </AdminList>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>

          <h2 className="section__subtitle">Your decks</h2>

          {profile.decks.length === 0 ? (
            <EmptyState
              message="No decks on this account yet. Build one in the Dueling Nexus editor and it will show up here."
              action={
                <a className="btn" href={EDITOR} target="_blank" rel="noopener noreferrer">
                  Open the editor
                </a>
              }
            />
          ) : (
            <DeckList decks={deckRows} />
          )}
        </Wrap>
      </main>

      <Footer />
    </>
  );
}
