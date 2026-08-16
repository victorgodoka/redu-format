import FallbackImage from "@/components/ui/FallbackImage";
import { CARD_ART } from "@/lib/banlist";
import type { NexusDeck } from "@/lib/nexus-parse";

const EDITOR = "https://duelingnexus.com/editor";

/**
 * `.decklist`/`.deck*` CSS stays global (globals.css) - shared with
 * `TopDeckList`'s wide event-detail variant of the same base classes.
 */
export default function DeckList({
  decks,
}: {
  decks: { deck: NexusDeck; legal: boolean; coverFallbackId: number | null }[];
}) {
  return (
    <ul className="decklist">
      {decks.map(({ deck, legal, coverFallbackId }) => (
        <li className={`deck panel${legal ? " deck--legal" : " deck--illegal"}`} key={deck.id}>
          <a className="deck__link" href={`${EDITOR}/${deck.id}`} target="_blank" rel="noopener noreferrer">
            <span className="deck__cover">
              {deck.coverId ? (
                <FallbackImage
                  key={deck.coverId}
                  src={`${CARD_ART}/${deck.coverId}.jpg`}
                  fallbackSrc={`${CARD_ART}/${coverFallbackId}.jpg`}
                  alt=""
                  width={72}
                  height={72}
                  sizes="72px"
                />
              ) : null}
            </span>
            <span className="deck__body">
              <span className="deck__legality">{legal ? "REDU legal" : "Not legal"}</span>
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
  );
}
