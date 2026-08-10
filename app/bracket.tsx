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
    <div className={`bracket__side${side.winner ? " bracket__side--win" : ""}`}>
      {side.seed !== undefined ? (
        <span className="bracket__seed">{side.seed}</span>
      ) : null}
      <span className="bracket__player">{side.name}</span>
      {side.score !== undefined ? (
        <span
          className={`bracket__score${side.winner ? " bracket__score--win" : ""}`}
        >
          {side.score}
        </span>
      ) : null}
    </div>
  );
}

function Match({ match }: { match: BracketMatch }) {
  return (
    <div className="bracket__match">
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
    <div className="bracket">
      {rounds.map((round, i) => {
        const isLast = i === rounds.length - 1;
        return (
          <div className="bracket__col" key={round.label}>
            <p className="bracket__label">{round.label}</p>
            <div className="bracket__round">
              {isLast
                ? round.matches.map((match, m) => (
                    <Match match={match} key={match.id ?? m} />
                  ))
                : pairUp(round.matches).map((pair, p) => (
                    <div className="bracket__pair" key={p}>
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
