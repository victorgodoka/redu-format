import FactsList from "@/components/ui/FactsList";
import { Card } from "@/lib/cards";
import type { DeckCardDelta, DeckSection, DeckSnapshot } from "@/lib/deck-diff";
import { formatDate } from "@/lib/events";
import type { DeckMismatchMetadata } from "@/lib/backend/services/deck-watch.service";
import styles from "./DeckMismatch.module.css";

const SECTION_LABEL: Record<DeckSection, string> = { main: "Main deck", extra: "Extra deck", side: "Side deck" };

/**
 * Metadata comes back off a JSON column, so it is `unknown` until proven
 * otherwise. A message whose payload doesn't parse still renders - the title
 * and body carry the alert on their own - it just shows no detail block.
 */
export function readDeckMismatch(metadata: unknown): DeckMismatchMetadata | null {
  if (typeof metadata !== "object" || metadata === null) return null;
  const value = metadata as Partial<DeckMismatchMetadata>;
  if (typeof value.deckId !== "string" || typeof value.tournament?.slug !== "string") return null;
  return value as DeckMismatchMetadata;
}

/** Copies of one card in one section, so the registered list reads like a decklist. */
function tally(ids: number[]): { id: number; name: string; copies: number }[] {
  const counts = new Map<number, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts]
    .map(([id, copies]) => ({ id, copies, name: new Card(id).name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function DeckDiff({ changes }: { changes: DeckCardDelta[] }) {
  return (
    <table className={styles.diff}>
      <caption className={styles.caption}>Registered deck vs. Dueling Nexus now</caption>
      <thead>
        <tr>
          <th scope="col">Section</th>
          <th scope="col">Card ID</th>
          <th scope="col">Card name</th>
          <th scope="col">Registered</th>
          <th scope="col">Now</th>
        </tr>
      </thead>
      <tbody>
        {changes.map((change) => (
          <tr
            className={styles.row}
            key={`${change.section}-${change.cardId}`}
            data-change={change.after === 0 ? "removed" : change.before === 0 ? "added" : "changed"}
          >
            <td>{SECTION_LABEL[change.section]}</td>
            <td className={styles.id}>{change.cardId}</td>
            <td>{change.cardName}</td>
            <td className={styles.count}>{change.before}</td>
            <td className={styles.count}>{change.after}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RegisteredDeck({ deck }: { deck: DeckSnapshot }) {
  return (
    <div className={styles.registered}>
      {(Object.keys(SECTION_LABEL) as DeckSection[]).map((section) => {
        const cards = tally(deck[section]);
        if (cards.length === 0) return null;
        return (
          <section key={section}>
            <h4 className={styles.sectionHead}>
              {SECTION_LABEL[section]} <span className={styles.sectionCount}>{deck[section].length}</span>
            </h4>
            <ul className={styles.cards}>
              {cards.map((card) => (
                <li key={card.id}>
                  <span className={styles.copies}>{card.copies}x</span>
                  <span>{card.name}</span>
                  <span className={styles.id}>{card.id}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export default function DeckMismatch({ data }: { data: DeckMismatchMetadata }) {
  const { tournament, player, changes, registered } = data;

  return (
    <div className={styles.detail}>
      <FactsList
        rows={[
          { label: "Tournament", value: tournament.name },
          { label: "Slug", value: tournament.slug },
          { label: "Starts", value: formatDate(tournament.startsAt) },
          { label: "Format", value: `${tournament.structure} - ${tournament.matchFormat}` },
          { label: "Status", value: tournament.status },
          { label: "Deck", value: data.deckName },
          { label: "Deck ID", value: <code className={styles.id}>{data.deckId}</code> },
          // Player identity is on the admin copy only, and never carries the
          // Nexus token the account is read with.
          ...(player
            ? [
                { label: "Player", value: player.name },
                { label: "Player ID", value: <code className={styles.id}>{player.id}</code> },
                { label: "Contributor", value: player.contributor ? "Yes" : "No" },
              ]
            : []),
        ]}
      />

      {changes && changes.length > 0 ? <DeckDiff changes={changes} /> : null}
      {registered ? (
        <>
          <h3 className={styles.head}>Your registered deck</h3>
          <RegisteredDeck deck={registered} />
        </>
      ) : null}
    </div>
  );
}
