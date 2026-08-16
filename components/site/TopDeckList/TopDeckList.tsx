import Image from "next/image";
import FallbackImage from "@/components/ui/FallbackImage";
import WikiLink from "@/components/ui/WikiLink";
import { CARD_ART, CARD_IMAGE } from "@/lib/banlist";
import { Card, cardsByIds } from "@/lib/cards";
import type { YcsDeck } from "@/lib/ycs-providence-2012";

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
            <WikiLink cardName={card.name}>
              <b>×{count}</b> {card.name}
            </WikiLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Renamed from the original local `DeckArt` to avoid colliding with the unrelated top-level `DeckArt` (floating background art) component. */
function DeckCardArtGrid({ title, ids }: { title: string; ids: readonly number[] }) {
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
            <DeckCardArtGrid title="Main" ids={deck.main} />
            <DeckCardArtGrid title="Extra" ids={deck.extra} />
            <DeckCardArtGrid title="Side" ids={deck.side} />
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

/**
 * `.decklist--wide`/`.deck*` CSS stays global (globals.css) - shared with
 * `DeckList`'s plain dashboard variant of the same base classes.
 */
export default function TopDeckList({ decks }: { decks: readonly YcsDeck[] }) {
  return (
    <ul className="decklist decklist--wide">
      {decks.map((deck) => (
        <DeckCard deck={deck} key={deck.id} />
      ))}
    </ul>
  );
}
