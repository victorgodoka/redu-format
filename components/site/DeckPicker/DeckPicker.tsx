"use client";

import { useActionState, useState } from "react";
import Button from "@/components/ui/Button";
import FallbackImage from "@/components/ui/FallbackImage";
import { CARD_ART } from "@/lib/banlist";
import { deckLegality, type NexusDeck } from "@/lib/nexus-parse";
import { describeError, type ValidatedDeck } from "@/lib/validateDecks";
import { register, type SignupState } from "@/app/events/[slug]/signup/actions";
import styles from "./DeckPicker.module.css";

const initial: SignupState = {};

/** Everything wrong with a deck, construction limits first. */
function problemsFor(deck: NexusDeck, list: ValidatedDeck | undefined) {
  const problems: string[] = [];

  const size = deckLegality(deck);
  if (size) problems.push(size);

  if (!list) {
    problems.push("Deck list could not be read from Dueling Nexus");
    return problems;
  }

  for (const error of list.errors) problems.push(describeError(error));
  return problems;
}

export default function DeckPicker({
  slug,
  decks,
  deckLists,
  coverFallbackIds,
  selectedDeckId,
  submitLabel = "Complete sign up",
}: {
  slug: string;
  decks: NexusDeck[];
  deckLists: ValidatedDeck[];
  /** Original passcode per deck id, in case the cover's own print has no art. */
  coverFallbackIds: Record<string, number>;
  /** Pre-select this deck (e.g. the one already registered) if it's still playable - falls back to the first playable deck. */
  selectedDeckId?: string;
  submitLabel?: string;
}) {
  const [state, action, pending] = useActionState(register, initial);

  const rows = decks.map((deck) => {
    const list = deckLists.find((d) => d.id === deck.id);
    const problems = problemsFor(deck, list);
    return { deck, problems, playable: problems.length === 0 };
  });

  const firstPlayable = rows.find((row) => row.playable)?.deck;
  const preselected = rows.find((row) => row.deck.id === selectedDeckId && row.playable)?.deck ?? firstPlayable;

  // Selection is state, not just a defaultChecked: filtering re-renders the
  // list, and the pick has to survive a deck scrolling out of view.
  const [picked, setPicked] = useState(preselected?.id);
  const [query, setQuery] = useState("");
  const [legalOnly, setLegalOnly] = useState(false);

  const term = query.trim().toLowerCase();
  const visible = rows.filter(
    (row) =>
      (!legalOnly || row.playable) && (term === "" || row.deck.name.toLowerCase().includes(term)),
  );
  // A pick the filter has hidden is still the pick - say so, rather than
  // letting someone submit a deck the page is no longer showing them.
  const hidden = picked && !visible.some((row) => row.deck.id === picked)
    ? rows.find((row) => row.deck.id === picked)?.deck
    : undefined;

  // Two decks can share a name (e.g. a main build and a testing copy) - a
  // trailing id fragment is the only thing telling them apart in the list.
  const nameCounts = new Map<string, number>();
  for (const deck of decks) nameCounts.set(deck.name, (nameCounts.get(deck.name) ?? 0) + 1);

  return (
    <form action={action} className={styles.picker}>
      <input type="hidden" name="slug" value={slug} />

      <fieldset className={styles.set}>
        <legend className={styles.legend}>Choose the deck you will play</legend>

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
            <input
              type="checkbox"
              checked={legalOnly}
              onChange={(e) => setLegalOnly(e.target.checked)}
            />
            <span>Only decks legal for this event</span>
          </label>
        </div>

        {hidden ? (
          <p className={styles.hiddenPick}>
            Still selected, hidden by the filter: <b>{hidden.name}</b>
          </p>
        ) : null}

        <ul className={styles.list}>
          {visible.length === 0 ? <li className={styles.empty}>No deck matches this filter.</li> : null}

          {visible.map(({ deck, problems, playable }) => (
            <li key={deck.id}>
              <label
                className={`${styles.pick}${playable ? "" : ` ${styles.illegal}`}`}
                htmlFor={`deck-${deck.id}`}
              >
                <input
                  id={`deck-${deck.id}`}
                  type="radio"
                  name="deckId"
                  value={deck.id}
                  disabled={!playable}
                  checked={deck.id === picked}
                  onChange={() => setPicked(deck.id)}
                  required
                />
                <span className={styles.cover}>
                  {deck.coverId ? (
                    <FallbackImage
                      key={deck.coverId}
                      src={`${CARD_ART}/${deck.coverId}.jpg`}
                      fallbackSrc={`${CARD_ART}/${coverFallbackIds[deck.id] ?? deck.coverId}.jpg`}
                      alt=""
                      width={120}
                      height={120}
                    />
                  ) : null}
                </span>
                <span className={styles.body}>
                  <span className={styles.name}>
                    {deck.name}
                    {(nameCounts.get(deck.name) ?? 0) > 1 ? (
                      <span className={styles.dupeId}> · #{deck.id.slice(0, 8)}</span>
                    ) : null}
                  </span>
                  <span className={styles.counts}>
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

                  {playable ? null : (
                    <span className={styles.problems}>
                      <span className={styles.problemsHead}>
                        {problems.length} {problems.length === 1 ? "problem" : "problems"}
                      </span>
                      <span className={styles.problemList}>
                        {problems.slice(0, 4).map((problem) => (
                          <span className={styles.problem} key={problem}>
                            {problem}
                          </span>
                        ))}
                        {problems.length > 4 ? (
                          <span className={`${styles.problem} ${styles.problemMore}`}>
                            and {problems.length - 4} more
                          </span>
                        ) : null}
                      </span>
                    </span>
                  )}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      {state.error ? (
        <p className="form__error" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button
        variant="solid"
        type="submit"
        disabled={pending || !firstPlayable}
        pending={pending}
        pendingLabel="Registering..."
      >
        {submitLabel}
      </Button>

      {firstPlayable ? null : (
        <p className="form__hint">
          None of your decks are legal for REDU Format yet. Fix the problems
          listed above in the Dueling Nexus editor, then reload this page.
        </p>
      )}
    </form>
  );
}
