"use client";

import { useState } from "react";
import FallbackImage from "@/components/ui/FallbackImage";
import { CARD_ART } from "@/lib/banlist";
import { normalizeID } from "@/lib/utils";
import { NEXUS_EDITOR_URL, type NexusDeck } from "@/lib/nexus-parse";
import styles from "./DeckList.module.css";

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
  // Same search + legal-only pattern as DeckPicker's signup flow - a duelist
  // with a big collection needs the same way to cut it down here.
  const [query, setQuery] = useState("");
  const [legalOnly, setLegalOnly] = useState(false);

  const term = query.trim().toLowerCase();
  const visible = decks.filter(
    ({ deck, legal }) => (!legalOnly || legal) && (term === "" || deck.name.toLowerCase().includes(term)),
  );

  return (
    <>
      <div className={styles.filters}>
        <input
          type="search"
          className={styles.search}
          placeholder="Filter by deck name"
          aria-label="Filter by deck name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className={styles.toggle}>
          <input type="checkbox" checked={legalOnly} onChange={(e) => setLegalOnly(e.target.checked)} />
          <span>Only REDU-legal decks</span>
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="form__hint">No deck matches this filter.</p>
      ) : (
        <ul className="decklist decklist--grid">
          {visible.map(({ deck, legal, coverFallbackId }) => (
            <li className={`deck panel${legal ? " deck--legal" : " deck--illegal"}`} key={deck.id}>
              <a className="deck__link" href={`${NEXUS_EDITOR_URL}/${deck.id}`} target="_blank" rel="noopener noreferrer">
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
      )}
    </>
  );
}
