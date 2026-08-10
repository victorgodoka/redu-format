import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Bracket } from "@/app/bracket";
import { CARD_ART, CARD_IMAGE } from "@/lib/banlist";
import { cardsByIds } from "@/lib/cards";
import { FEATURED_EVENT, formatDate } from "@/lib/events";
import {
  YCS_PROVIDENCE_2012_BRACKET,
  YCS_PROVIDENCE_2012_DECKS,
  type YcsDeck,
} from "@/lib/ycs-providence-2012";
import SiteHeader from "../../site-header";

export const metadata: Metadata = {
  title: `${FEATURED_EVENT.name} | REDU Format`,
  description: `Results, bracket and Top 8 decklists from ${FEATURED_EVENT.name}.`,
  alternates: { canonical: `/events/${FEATURED_EVENT.slug}` },
};

const EDITOR = "https://duelingnexus.com/editor";

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
            <b>×{count}</b> {card.name}
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
            <Image
              src={`${CARD_IMAGE}/${card.id}.jpg`}
              alt={card.name}
              width={421}
              height={614}
              sizes="128px"
            />
            <span className="deck__art-count">×{count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DeckCard({ deck }: { deck: YcsDeck }) {
  return (
    <li className="deck panel">
      <div className="deck__link">
        <div className="deck__cover">
          {(deck.covers ?? [deck.main[0], deck.main[3]]).map((card) => <Image
            src={`${CARD_ART}/${card}.jpg`}
            key={card}
            alt={""}
            width={340}
            height={340}
            sizes="416px"
          />)}
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

// Only the featured YCS survives today; every other slug is still a signup-only
// mock. The bracket and deck data will grow real per-slug lookups once REDU's
// own events have results to show here.
export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (slug !== FEATURED_EVENT.slug) notFound();

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <SiteHeader />

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
    </>
  );
}
