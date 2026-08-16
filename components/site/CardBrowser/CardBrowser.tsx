"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Button from "@/components/ui/Button";
import FallbackImage from "@/components/ui/FallbackImage";
import Tab from "@/components/ui/Tab";
import Lede from "@/components/ui/Lede";
import { CARD_IMAGE } from "@/lib/banlist";
import { parseCardText, type CardJson } from "@/lib/card-text";
import styles from "./CardBrowser.module.css";

export type BrowserCard = CardJson;

export type BrowserSection = {
  slug: string;
  label: string;
  copies: string;
  note: string;
  legality: string;
  cards: BrowserCard[];
};

type Selection = { card: BrowserCard; legality: string };

/** Tablet and below: no room for a side panel, and no hover to drive it. */
const COMPACT = "(max-width: 1024px)";
const LONG_PRESS_MS = 500;

const LEGALITY_CLASS: Record<string, string> = {
  forbidden: styles.legalityForbidden,
  limited: styles.legalityLimited,
  "semi-limited": styles.legalitySemiLimited,
};

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(COMPACT);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * useSyncExternalStore rather than an effect: it gives a server snapshot, so
 * the first client render matches the HTML instead of flipping after mount.
 */
function useCompact() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(COMPACT).matches,
    () => false,
  );
}

/** Shared by the desktop panel and the compact modal. */
function CardDetail({ card, legality }: Selection) {
  const toneClass = LEGALITY_CLASS[legality.toLowerCase().split(" ")[0]] ?? "";

  return (
    <>
      <FallbackImage
        key={card.printId}
        className={styles.previewArt}
        src={`${CARD_IMAGE}/${card.printId}.jpg`}
        fallbackSrc={`${CARD_IMAGE}/${card.id}.jpg`}
        alt={card.name}
        width={421}
        height={614}
        sizes="(max-width: 1024px) 60vw, 340px"
      />

      <div className={`${styles.previewBody} panel`}>
        <h3 className={styles.previewName}>{card.name}</h3>

        <dl className={styles.previewFacts}>
          <div>
            <dt>Passcode</dt>
            <dd>{card.id}</dd>
          </div>
          {card.koid !== null ? (
            <div>
              <dt>Konami id</dt>
              <dd>{card.koid}</dd>
            </div>
          ) : null}
          <div>
            <dt>Legality</dt>
            <dd className={toneClass}>{legality}</dd>
          </div>
        </dl>

        <p className={styles.previewDesc}>
          {parseCardText(card.desc).map((part, i) =>
            part.bold ? <b key={i}>{part.text}</b> : <span key={i}>{part.text}</span>,
          )}
        </p>

        <Button variant="solid" href={card.rulingsUrl} target="_blank" rel="noopener noreferrer">
          View rulings
        </Button>
      </div>
    </>
  );
}

export default function CardBrowser({
  sections,
}: {
  sections: BrowserSection[];
}) {
  const compact = useCompact();

  const first = sections[0]?.cards[0];
  const [hovered, setHovered] = useState<Selection | null>(
    first ? { card: first, legality: sections[0].legality } : null,
  );
  const [modal, setModal] = useState<Selection | null>(null);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);

  // Drive the native dialog from state; showModal brings focus trapping,
  // Escape-to-close and an inert background with no extra code.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (modal && !dialog.open) dialog.showModal();
    if (!modal && dialog.open) dialog.close();
  }, [modal]);

  function cancelPress() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }

  function startPress(selection: Selection) {
    if (!compact) return;
    fired.current = false;
    cancelPress();
    timer.current = setTimeout(() => {
      fired.current = true;
      setModal(selection);
    }, LONG_PRESS_MS);
  }

  return (
    <div className={styles.browser}>
      <div>
        {sections.map((section) => (
          <section className="section" id={section.slug} key={section.slug}>
            <div className={styles.browserHead}>
              <Tab>{section.copies}</Tab>
              <h2 className="section__title">
                {section.label} <span className={styles.sectionCount}>({section.cards.length})</span>
              </h2>
              <Lede>{section.note}</Lede>
            </div>

            <ul className={styles.cards}>
              {section.cards.map((card) => {
                const selection = { card, legality: section.legality };

                return (
                  <li className={styles.card} key={card.id}>
                    <button
                      type="button"
                      className={`${styles.cardArt}${
                        !compact && hovered?.card.id === card.id ? ` ${styles.cardArtOn}` : ""
                      }`}
                      // Desktop drives the side panel; compact drives the modal.
                      onMouseEnter={() => !compact && setHovered(selection)}
                      onFocus={() => !compact && setHovered(selection)}
                      onPointerDown={() => startPress(selection)}
                      onPointerUp={cancelPress}
                      onPointerLeave={cancelPress}
                      onPointerCancel={cancelPress}
                      // A long press on an image otherwise opens the OS callout.
                      onContextMenu={(e) => compact && e.preventDefault()}
                      onClick={(e) => {
                        if (fired.current) e.preventDefault();
                      }}
                      aria-label={
                        compact
                          ? `${card.name}, ${section.legality}. Press and hold for details`
                          : `${card.name}, ${section.legality}`
                      }
                    >
                      <FallbackImage
                        src={`${CARD_IMAGE}/${card.printId}.jpg`}
                        fallbackSrc={`${CARD_IMAGE}/${card.id}.jpg`}
                        alt=""
                        width={421}
                        height={614}
                        sizes="(max-width: 640px) 30vw, 150px"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {/* Desktop only: hidden below the breakpoint by CSS as well, so it never
          costs layout on a phone. */}
      {compact ? null : (
        <aside className={styles.preview} aria-live="polite">
          {hovered ? (
            <div className={styles.previewInner}>
              <CardDetail {...hovered} />
            </div>
          ) : null}
        </aside>
      )}

      {/* The modal exists only in compact mode. */}
      {compact ? (
        <dialog
          className={styles.cardModal}
          ref={dialogRef}
          onClose={() => setModal(null)}
          onClick={(e) => {
            // Clicks on the backdrop land on the dialog itself.
            if (e.target === dialogRef.current) setModal(null);
          }}
        >
          {modal ? (
            <div className={styles.cardModalInner}>
              <button
                type="button"
                className={styles.cardModalClose}
                onClick={() => setModal(null)}
              >
                Close
              </button>
              <CardDetail {...modal} />
            </div>
          ) : null}
        </dialog>
      ) : null}
    </div>
  );
}
