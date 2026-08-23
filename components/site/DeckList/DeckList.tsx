import FallbackImage from "@/components/ui/FallbackImage";
import { CARD_ART } from "@/lib/banlist";
import { normalizeID } from "@/lib/utils";
import type { NexusDeck } from "@/lib/nexus-parse";

const EDITOR = "https://duelingnexus.com/editor";

/**
 * `.decklist`/`.deck*` CSS stays global (globals.css) - shared with
 * `TopDeckList`'s wide event-detail variant of the same base classes.
 * The `decklist--grid` modifier here is this component's own poster-card
 * variant, layered on the same base classes the same way `decklist--wide` is.
 */
export default function DeckList({
  decks,
}: {
  decks: { deck: NexusDeck; legal: boolean; coverFallbackId: number | null }[];
}) {
  return (
    <ul className="decklist decklist--grid">
      {decks.map(({ deck, legal, coverFallbackId }) => (
        <li className={`deck panel${legal ? " deck--legal" : " deck--illegal"}`} key={deck.id}>
          <a className="deck__link" href={`${EDITOR}/${deck.id}`} target="_blank" rel="noopener noreferrer">
            <span className="deck__cover">
              {deck.coverId ? (
                <FallbackImage
                  key={deck.coverId}
                  src={`${CARD_ART}/${normalizeID(deck.coverId, true)}.jpg`}
                  fallbackSrc={`${CARD_ART}/${coverFallbackId}.jpg`}
                  alt=""
                  width={440}
                  height={440}
                  sizes="(min-width: 1080px) 260px, (min-width: 640px) 33vw, 45vw"
                />
              ) : null}
              <span className="deck__legality">{legal ? "REDU legal" : "Not legal"}</span>
            </span>
            <span className="deck__body">
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
