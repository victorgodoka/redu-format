import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { deckLegality, fetchProfile, getSession } from "@/lib/auth";
import { CARD_ART } from "@/lib/banlist";
import {
  formatDate,
  formatTime,
  isPast,
  mockPlacement,
  pastEvents,
} from "@/lib/events";
import { listTournaments } from "@/lib/tournaments";
import { validateDecks } from "@/lib/validateDecks";
import { logout, refresh } from "../login/actions";
import SiteHeader from "../site-header";

export const metadata: Metadata = {
  title: "Your decks | REDU Format",
  robots: { index: false, follow: false },
};

const EDITOR = "https://duelingnexus.com/editor";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session.token) redirect("/login");

  // A revoked token fails here rather than at login. Hand off to the logout
  // route, which is allowed to clear the cookie; clearing it during this render
  // would throw, and leaving it would bounce between /login and /dashboard.
  const profile = await fetchProfile(session.token);
  if (!profile) redirect("/api/auth/logout");

  // REDU-legal decks surface first, with their own visual treatment, so a
  // duelist with many decks does not have to hunt for the playable ones.
  const validatedLists = validateDecks(profile.deckLists);
  const deckRows = profile.decks
    .map((deck) => {
      const list = validatedLists.find((d) => d.id === deck.id);
      const legal = !deckLegality(deck) && (list?.valid ?? false);
      return { deck, legal };
    })
    .sort((a, b) => Number(b.legal) - Number(a.legal));

  const allEvents = [...(await listTournaments()), ...pastEvents];
  const now = new Date();
  const yourEvents = (session.signups ?? [])
    .map((signup) => {
      const event = allEvents.find((e) => e.slug === signup.e);
      if (!event) return null;
      return {
        event,
        deck: profile.decks.find((d) => d.id === signup.d),
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

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <SiteHeader />

      <main className="section" id="main">
        <div className="wrap">
          <p className="tab">Your account</p>

          <div className="profile">
            {profile.avatar ? (
              <Image
                className="profile__avatar"
                src={profile.avatar}
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
                <button className="btn" type="submit">
                  Refresh
                </button>
              </form>
              <form action={logout}>
                <button className="btn" type="submit">
                  Sign out
                </button>
              </form>
            </div>
          </div>

          {yourEvents.length > 0 ? (
            <>
              <h2 className="section__subtitle">Your events</h2>

              {upcomingEvents.length > 0 ? (
                <ul className="admin-list">
                  {upcomingEvents.map(({ event, deck }) => (
                    <li className="admin-row panel" key={event.slug}>
                      <div className="admin-row__main">
                        <span className="admin-row__title">{event.name}</span>
                        <span className="admin-row__meta">
                          {formatDate(event.startsAt)} · {formatTime(event.startsAt)}
                          {deck ? ` · ${deck.name}` : ""}
                        </span>
                      </div>
                      <div className="admin-row__actions">
                        <Link className="btn" href={`/events/${event.slug}`}>
                          View event
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}

              {pastYourEvents.length > 0 ? (
                <ul className="admin-list">
                  {pastYourEvents.map(({ event, deck }) => (
                    <li className="admin-row panel" key={event.slug}>
                      <div className="admin-row__main">
                        <span className="admin-row__title">{event.name}</span>
                        <span className="admin-row__meta">
                          {formatDate(event.startsAt)}
                          {deck ? ` · ${deck.name}` : ""} · Mock standing{" "}
                          {mockPlacement(`${event.slug}:${profile.name}`, event.taken)} of{" "}
                          {event.taken}
                        </span>
                      </div>
                      <div className="admin-row__actions">
                        <Link className="btn" href={`/events/${event.slug}`}>
                          View results
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}

          {profile.decks.length === 0 ? (
            <div className="empty panel">
              <p className="lede">
                No decks on this account yet. Build one in the Dueling Nexus
                editor and it will show up here.
              </p>
              <a
                className="btn"
                href={EDITOR}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open the editor
              </a>
            </div>
          ) : (
            <ul className="decklist">
              {deckRows.map(({ deck, legal }) => (
                <li
                  className={`deck panel${legal ? " deck--legal" : " deck--illegal"}`}
                  key={deck.id}
                >
                  <a
                    className="deck__link"
                    href={`${EDITOR}/${deck.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="deck__cover">
                      {deck.coverId ? (
                        <Image
                          src={`${CARD_ART}/${deck.coverId}.jpg`}
                          alt=""
                          width={72}
                          height={72}
                          sizes="72px"
                        />
                      ) : null}
                    </span>
                    <span className="deck__body">
                      <span className="deck__legality">
                        {legal ? "REDU legal" : "Not legal"}
                      </span>
                      <span className="deck__name">{deck.name}</span>
                      <span className="deck__counts">
                        <span>
                          <b>{deck.main}</b> main
                        </span>
                        <span>
                          <b>{deck.extra}</b> extra
                        </span>
                        <span>
                          <b>{deck.side}</b> side
                        </span>
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}
