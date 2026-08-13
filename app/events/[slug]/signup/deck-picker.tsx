"use client";

import { useActionState } from "react";
import CardImage from "@/app/card-image";
import { CARD_ART } from "@/lib/banlist";
import { deckLegality, type NexusDeck } from "@/lib/nexus-parse";
import { describeError, type ValidatedDeck } from "@/lib/validateDecks";
import { register, type SignupState } from "./actions";

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
}: {
  slug: string;
  decks: NexusDeck[];
  deckLists: ValidatedDeck[];
  /** Original passcode per deck id, in case the cover's own print has no art. */
  coverFallbackIds: Record<string, number>;
}) {
  const [state, action, pending] = useActionState(register, initial);

  const rows = decks.map((deck) => {
    const list = deckLists.find((d) => d.id === deck.id);
    const problems = problemsFor(deck, list);
    return { deck, problems, playable: problems.length === 0 };
  });

  const firstPlayable = rows.find((row) => row.playable)?.deck;

  return (
    <form action={action} className="picker">
      <input type="hidden" name="slug" value={slug} />

      <fieldset className="picker__set">
        <legend className="picker__legend">Choose the deck you will play</legend>

        <ul className="picker__list">
          {rows.map(({ deck, problems, playable }) => (
            <li key={deck.id}>
              <label
                className={`pick${playable ? "" : " pick--illegal"}`}
                htmlFor={`deck-${deck.id}`}
              >
                <input
                  id={`deck-${deck.id}`}
                  type="radio"
                  name="deckId"
                  value={deck.id}
                  disabled={!playable}
                  defaultChecked={deck.id === firstPlayable?.id}
                  required
                />
                <span className="pick__cover">
                  {deck.coverId ? (
                    <CardImage
                      key={deck.coverId}
                      src={`${CARD_ART}/${deck.coverId}.jpg`}
                      fallbackSrc={`${CARD_ART}/${coverFallbackIds[deck.id] ?? deck.coverId}.jpg`}
                      alt=""
                      width={120}
                      height={120}
                    />
                  ) : null}
                </span>
                <span className="pick__body">
                  <span className="pick__name">{deck.name}</span>
                  <span className="pick__counts">
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
                    <span className="pick__problems">
                      <span className="pick__problems-head">
                        {problems.length}{" "}
                        {problems.length === 1 ? "problem" : "problems"}
                      </span>
                      <span className="pick__problem-list">
                        {problems.slice(0, 4).map((problem) => (
                          <span className="pick__problem" key={problem}>
                            {problem}
                          </span>
                        ))}
                        {problems.length > 4 ? (
                          <span className="pick__problem pick__problem--more">
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

      <button
        className="btn btn--solid"
        type="submit"
        disabled={pending || !firstPlayable}
      >
        {pending ? "Registering..." : "Complete sign up"}
      </button>

      {firstPlayable ? null : (
        <p className="form__hint">
          None of your decks are legal for REDU Format yet. Fix the problems
          listed above in the Dueling Nexus editor, then reload this page.
        </p>
      )}
    </form>
  );
}
