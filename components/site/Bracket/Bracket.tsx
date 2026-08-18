import styles from "./Bracket.module.css";

export type BracketSide = {
  seed?: number | string;
  name: string;
  score?: number | string;
  winner?: boolean;
};

export type BracketMatch = {
  id?: string;
  sides: readonly [BracketSide, BracketSide];
};

export type BracketRound = {
  label: string;
  matches: readonly BracketMatch[];
};

function Side({ side }: { side: BracketSide }) {
  return (
    <div className={`${styles.side}${side.winner ? ` ${styles.sideWin}` : ""}`}>
      {side.seed !== undefined ? <span className={styles.seed}>{side.seed}</span> : null}
      <span className={styles.player}>{side.name}</span>
      {side.score !== undefined ? (
        <span className={`${styles.score}${side.winner ? ` ${styles.scoreWin}` : ""}`}>
          {side.score}
        </span>
      ) : null}
    </div>
  );
}

function Match({ match }: { match: BracketMatch }) {
  return (
    <div className={styles.match}>
      <Side side={match.sides[0]} />
      <Side side={match.sides[1]} />
    </div>
  );
}

function pairUp(matches: readonly BracketMatch[]): BracketMatch[][] {
  const pairs: BracketMatch[][] = [];
  for (let i = 0; i < matches.length; i += 2) {
    pairs.push([...matches.slice(i, i + 2)]);
  }
  return pairs;
}

/**
 * Single-elimination bracket, driven entirely by data so it works for any
 * mocked event today and any real one later. Every round but the last needs
 * an even match count: each pair is wrapped so the connecting line to the
 * next round can be positioned as a percentage of the pair's own height,
 * which lines the tree up without measuring anything in JS.
 */
export function Bracket({ rounds }: { rounds: readonly BracketRound[] }) {
  return (
    <div className={styles.bracket}>
      {rounds.map((round, i) => {
        const isLast = i === rounds.length - 1;
        return (
          <div className={styles.col} key={round.label}>
            <p className={styles.label}>{round.label}</p>
            <div className={styles.round}>
              {isLast
                ? round.matches.map((match, m) => <Match match={match} key={match.id ?? m} />)
                : pairUp(round.matches).map((pair, p) => (
                    <div className={styles.pair} key={p}>
                      {pair.map((match, m) => (
                        <Match match={match} key={match.id ?? m} />
                      ))}
                    </div>
                  ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
