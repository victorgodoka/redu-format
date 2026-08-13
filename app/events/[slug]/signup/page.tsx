import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import FallbackImage from "../../../fallback-image";
import { fetchProfile, getSession } from "@/lib/auth";
import { Card } from "@/lib/cards";
import { formatDate, formatEntry, formatTime, isPast, pastEvents, seatsLeft, STRUCTURES } from "@/lib/events";
import { DEFAULT_AVATAR } from "@/lib/nexus-parse";
import { getTournament } from "@/lib/tournaments";
import SiteHeader from "../../../site-header";
import { cancel } from "./actions";
import DeckPicker from "./deck-picker";
import { validateDecks } from "@/lib/validateDecks";

export const metadata: Metadata = {
  title: "Event sign up | REDU Format",
  robots: { index: false, follow: false },
};

export default async function SignupPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = (await getTournament(slug)) ?? pastEvents.find((e) => e.slug === slug);
  if (!event) notFound();

  const session = await getSession();
  // Bounce through login, then come straight back to this signup.
  if (!session.token) {
    redirect(`/login?next=${encodeURIComponent(`/events/${slug}/signup`)}`);
  }

  const profile = await fetchProfile(session.token);
  if (!profile) redirect("/api/auth/logout");

  const validDecklists = validateDecks(profile.deckLists);
  // Cover art can point at an errata id; the original passcode is what the
  // fallback image retries if that specific print was never mirrored.
  const coverFallbackIds = Object.fromEntries(
    profile.decks
      .filter((deck) => deck.coverId !== null)
      .map((deck) => [deck.id, new Card(deck.coverId!).id]),
  );

  const now = new Date();
  const past = isPast(event, now);
  const left = seatsLeft(event);
  const registeredId = session.signups?.find((s) => s.e === slug)?.d;
  const registeredDeck = profile.decks.find((d) => d.id === registeredId);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <SiteHeader />

      <main className="section" id="main">
        <div className="wrap">
          <p className="tab">Sign up</p>
          <h1 className="section__title">{event.name}</h1>

          <div className="signup">
            <div className="signup__main">
              {past ? (
                <div className="notice panel">
                  <p className="lede">
                    This event finished on {formatDate(event.startsAt)}.
                    Registration is closed.
                  </p>
                  <Link className="btn" href="/events">
                    Back to events
                  </Link>
                </div>
              ) : left === 0 && !registeredDeck ? (
                <div className="notice panel">
                  <p className="lede">
                    Every seat is taken. Keep an eye on the event page in case
                    one opens up.
                  </p>
                  <Link className="btn" href="/events">
                    Back to events
                  </Link>
                </div>
              ) : registeredDeck ? (
                <div className="notice notice--done panel">
                  <p className="tab">Registered</p>
                  <h2 className="notice__title">
                    You are in with {registeredDeck.name}
                  </h2>
                  <p className="lede">
                    {registeredDeck.main} main · {registeredDeck.extra} extra ·{" "}
                    {registeredDeck.side} side. Bring it to{" "}
                    {formatDate(event.startsAt)} at {formatTime(event.startsAt)}.
                  </p>
                  <div className="notice__actions">
                    <form action={cancel}>
                      <input type="hidden" name="slug" value={slug} />
                      <button className="btn" type="submit">
                        Cancel registration
                      </button>
                    </form>
                    <Link className="btn btn--quiet" href="/events">
                      Back to events
                    </Link>
                  </div>
                </div>
              ) : profile.decks.length === 0 ? (
                <div className="notice panel">
                  <p className="lede">
                    You have no decks on Dueling Nexus yet. Build one in the
                    editor, then come back to register.
                  </p>
                  <a
                    className="btn"
                    href="https://duelingnexus.com/editor"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open the editor
                  </a>
                </div>
              ) : (
                <DeckPicker
                  slug={slug}
                  decks={profile.decks}
                  deckLists={validDecklists}
                  coverFallbackIds={coverFallbackIds}
                />
              )}
            </div>

            <aside className="signup__side">
              <div className="profile-card panel">
                <p className="tab">Duelist</p>
                <div className="profile-card__who">
                  {profile.avatar ? (
                    <FallbackImage
                      key={profile.avatar}
                      className="profile__avatar"
                      src={profile.avatar}
                      fallbackSrc={DEFAULT_AVATAR}
                      alt=""
                      width={56}
                      height={56}
                    />
                  ) : null}
                  <div>
                    <p className="profile-card__name">{profile.name}</p>
                    <p className="profile-card__meta">
                      {profile.decks.length}{" "}
                      {profile.decks.length === 1 ? "deck" : "decks"}
                      {profile.contributor ? " · Contributor" : ""}
                    </p>
                  </div>
                </div>
              </div>

              <dl className="facts panel">
                <div className="facts__row">
                  <dt>Starts</dt>
                  <dd>
                    {formatDate(event.startsAt)}, {formatTime(event.startsAt)}
                  </dd>
                </div>
                <div className="facts__row">
                  <dt>Structure</dt>
                  <dd>{STRUCTURES[event.structure].label}</dd>
                </div>
                <div className="facts__row">
                  <dt>Rounds</dt>
                  <dd>
                    {event.rounds} · {event.matchFormat} ·{" "}
                    {event.timeLimit} min + 3 turns
                    {event.topCut ? ` · Top ${event.topCut}` : ""}
                  </dd>
                </div>
                <div className="facts__row">
                  <dt>Seats</dt>
                  <dd>
                    {event.seats === null
                      ? `${event.taken} registered (unlimited)`
                      : past
                        ? `${event.taken} of ${event.seats} duelists`
                        : `${left} of ${event.seats} left`}
                  </dd>
                </div>
                <div className="facts__row">
                  <dt>Host</dt>
                  <dd>
                    {event.host} · {formatEntry(event.entry)}
                  </dd>
                </div>
              </dl>
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}
