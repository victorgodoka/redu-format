import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bracket } from "@/app/bracket";
import FallbackImage from "@/app/fallback-image";
import { fetchProfile, getSession } from "@/lib/auth";
import { CARD_ART, CARD_IMAGE } from "@/lib/banlist";
import { Card, cardsByIds } from "@/lib/cards";
import {
  FEATURED_EVENT,
  formatDate,
  formatEntry,
  formatTime,
  isPast,
  mockPlacement,
  pastEvents,
  seatsLeft,
  STRUCTURES,
} from "@/lib/events";
import { getTournament } from "@/lib/tournaments";
import {
  YCS_PROVIDENCE_2012_BRACKET,
  YCS_PROVIDENCE_2012_DECKS,
  type YcsDeck,
} from "@/lib/ycs-providence-2012";
import SiteHeader from "../../site-header";
import { WikiLink } from "@/app/wiki-link";

const EDITOR = "https://duelingnexus.com/editor";

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

/** Ids repeat in the source list once per copy; this collapses them to counts. */
function groupCards(ids: readonly number[]) {
  const counts = new Map<number, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return cardsByIds([...counts.keys()]).map((card) => ({
    card,
    count: counts.get(card.id) ?? 0,
  }));
}

function DeckSection({ title, ids }: { title: string; ids: readonly number[] }) {
  const rows = groupCards(ids);
  if (rows.length === 0) return null;

  return (
    <div className="deck__section">
      <p className="deck__section-title">
        {title} · {ids.length}
      </p>
      <ul className="deck__cards">
        {rows.map(({ card, count }) => (
          <li key={card.id}>
            <WikiLink cardName={card.name}>
              <b>×{count}</b> {card.name}
            </WikiLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DeckArt({ title, ids }: { title: string; ids: readonly number[] }) {
  const rows = groupCards(ids);
  if (rows.length === 0) return null;

  return (
    <div className="deck__section">
      <p className="deck__section-title">
        {title} · {ids.length}
      </p>
      <ul className="deck__art-grid">
        {rows.map(({ card, count }) => (
          <li className="deck__art-card" key={card.id} title={card.name}>
            <WikiLink cardName={card.name}>
              <Image
                src={`${CARD_IMAGE}/${card.id}.jpg`}
                alt={card.name}
                width={421}
                height={614}
                sizes="128px"
              />
              <span className="deck__art-count">×{count}</span>
            </WikiLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DeckCard({ deck }: { deck: YcsDeck }) {
  const coverId = deck.cover ?? deck.main[0];
  return (
    <li className="deck panel">
      <div className="deck__link">
        <div className="deck__cover">
          <FallbackImage
            key={coverId}
            src={`${CARD_ART}/${coverId}.jpg`}
            fallbackSrc={`${CARD_ART}/${new Card(coverId).id}.jpg`}
            alt=""
            width={680}
            height={680}
            sizes="416px"
          />
        </div>
        <div className="deck__body">
          <span className="deck__place">{deck.place}</span>
          <span className="deck__name">{deck.archetype}</span>
          <span className="deck__player">{deck.player}</span>
          <dl className="deck__counts">
            <dt>
              <b>{deck.main.length}</b> main
            </dt>
            <dt>
              <b>{deck.extra.length}</b> extra
            </dt>
            <dt>
              <b>{deck.side.length}</b> side
            </dt>
          </dl>
        </div>

        <div className="deck__actions">
          <a
            className="btn btn--solid"
            href={`${EDITOR}/${deck.id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Save Deck
          </a>
        </div>
      </div>

      <details className="deck__list">
        <summary>Full decklist</summary>
        {/* radio-driven tabs: images shown first, no client JS needed */}
        <div className="deck__view">
          <input
            className="deck__view-radio"
            type="radio"
            name={`view-${deck.id}`}
            id={`view-${deck.id}-images`}
            defaultChecked
          />
          <label className="deck__view-tab" htmlFor={`view-${deck.id}-images`}>
            Images
          </label>
          <input
            className="deck__view-radio"
            type="radio"
            name={`view-${deck.id}`}
            id={`view-${deck.id}-text`}
          />
          <label className="deck__view-tab" htmlFor={`view-${deck.id}-text`}>
            Text
          </label>

          <div className="deck__view-panel deck__view-panel--images">
            <DeckArt title="Main" ids={deck.main} />
            <DeckArt title="Extra" ids={deck.extra} />
            <DeckArt title="Side" ids={deck.side} />
          </div>
          <div className="deck__view-panel deck__view-panel--text">
            <DeckSection title="Main" ids={deck.main} />
            <DeckSection title="Extra" ids={deck.extra} />
            <DeckSection title="Side" ids={deck.side} />
          </div>
        </div>
      </details>
    </li>
  );
}

function FeaturedEventPage() {
  return (
    <main className="section" id="main">
      <div className="wrap">
        <p className="tab">Hall of Fame</p>
        <h1 className="section__title">{FEATURED_EVENT.name}</h1>

        <dl className="facts panel">
          <div className="facts__row">
            <dt>Date</dt>
            <dd>{formatDate(FEATURED_EVENT.date)}</dd>
          </div>
          <div className="facts__row">
            <dt>Winner</dt>
            <dd>{FEATURED_EVENT.winner}</dd>
          </div>
          <div className="facts__row">
            <dt>Community</dt>
            <dd>{FEATURED_EVENT.community}</dd>
          </div>
          <div className="facts__row">
            <dt>Players</dt>
            <dd>{FEATURED_EVENT.players.toLocaleString("en-GB")}</dd>
          </div>
          <div className="facts__row">
            <dt>Format</dt>
            <dd>{FEATURED_EVENT.format}</dd>
          </div>
          <div className="facts__row">
            <dt>Winning deck</dt>
            <dd>{FEATURED_EVENT.winningDeck}</dd>
          </div>
        </dl>

        <h2 className="section__subtitle">Bracket</h2>
        <Bracket rounds={YCS_PROVIDENCE_2012_BRACKET} />

        <h2 className="section__subtitle" id="decklists">
          Top decks
        </h2>
        <ul className="decklist decklist--wide">
          {YCS_PROVIDENCE_2012_DECKS.map((deck) => (
            <DeckCard deck={deck} key={deck.id} />
          ))}
        </ul>
      </div>
    </main>
  );
}

async function GenericEventPage({ slug }: { slug: string }) {
  const event = (await getTournament(slug)) ?? pastEvents.find((e) => e.slug === slug);
  if (!event) notFound();

  const session = await getSession();
  const profile = session.token ? await fetchProfile(session.token) : null;
  const registeredId = session.signups?.find((s) => s.e === slug)?.d;
  const registeredDeck = profile?.decks.find((d) => d.id === registeredId);

  const now = new Date();
  const past = isPast(event, now);
  const left = seatsLeft(event);

  return (
    <main className="section" id="main">
      <div className="wrap">
        <p className="tab">{past ? "Results" : "Tournament"}</p>
        <h1 className="section__title">{event.name}</h1>

        <div className="signup">
          <div className="signup__main">
            {registeredDeck ? (
              <div className="notice notice--done panel">
                <p className="tab">{past ? "You played" : "Registered"}</p>
                <h2 className="notice__title">
                  {registeredDeck.name}
                </h2>
                {past ? (
                  <p className="lede">
                    Mock standing: {mockPlacement(`${slug}:${profile?.name ?? ""}`, event.taken)} of{" "}
                    {event.taken}. Real results land here once the backend
                    tracks match outcomes.
                  </p>
                ) : (
                  <p className="lede">
                    {registeredDeck.main} main · {registeredDeck.extra} extra ·{" "}
                    {registeredDeck.side} side. Bring it to{" "}
                    {formatDate(event.startsAt)} at {formatTime(event.startsAt)}.
                  </p>
                )}
                {past ? null : (
                  <Link className="btn" href={`/events/${slug}/signup`}>
                    Manage registration
                  </Link>
                )}
              </div>
            ) : (
              <div className="notice panel">
                <p className="lede">
                  {past
                    ? "This event has finished."
                    : left === 0
                      ? "Every seat is taken."
                      : "You are not registered for this event yet."}
                </p>
                {past ? null : (
                  <Link className="btn btn--solid" href={`/events/${slug}/signup`}>
                    {left === 0 ? "Join the waitlist" : "Sign up"}
                  </Link>
                )}
              </div>
            )}
          </div>

          <aside className="signup__side">
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
                  {event.rounds} · {event.matchFormat} · {event.timeLimit} min +
                  3 turns
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
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <SiteHeader />

      {slug === FEATURED_EVENT.slug ? (
        <FeaturedEventPage />
      ) : (
        <GenericEventPage slug={slug} />
      )}
    </>
  );
}
