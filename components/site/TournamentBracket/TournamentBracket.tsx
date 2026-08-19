import Bracket, { type BracketRound } from "@/components/site/Bracket";
import Countdown from "@/components/site/Countdown";
import AdminList, { AdminRow } from "@/components/admin/AdminList";
import { formatDate, formatTime } from "@/lib/events";
import type { BracketMatch, BracketView } from "@/lib/backend/services/results.service";

/** Elimination round names read off the size of the round itself - a 1-match round is the final, whatever number the engine gave it. */
function cutLabel(matchCount: number): string {
  if (matchCount <= 1) return "Final";
  if (matchCount === 2) return "Semifinals";
  if (matchCount === 4) return "Quarterfinals";
  return `Round of ${matchCount * 2}`;
}

function score(match: BracketMatch): { p1: string; p2: string } | null {
  if (!match.hasResult) return null;
  return { p1: String(match.player1?.win ?? 0), p2: String(match.player2?.win ?? 0) };
}

/** What a match is doing right now, in one line: the score if it is done, its clock if it is live. */
function MatchState({ match }: { match: BracketMatch }) {
  const s = score(match);
  if (match.bye) return <>Automatic win</>;
  if (s) return <>{`${s.p1}-${s.p2}`}</>;
  if (match.active && match.deadlineAt) {
    return (
      <>
        In progress ·{" "}
        <Countdown
          to={match.deadlineAt}
          fallback={`closes ${formatDate(match.deadlineAt)} ${formatTime(match.deadlineAt)}`}
        />{" "}
        left
      </>
    );
  }
  return <>{match.active ? "In progress" : "Waiting on its players"}</>;
}

function toMatchNode(m: BracketMatch) {
  const s = score(m);
  return {
    id: m.id,
    sides: [
      {
        name: m.player1?.name ?? "TBD",
        score: s?.p1,
        winner: m.hasResult && (m.player1?.win ?? 0) > (m.player2?.win ?? 0),
      },
      {
        name: m.bye ? "Bye" : (m.player2?.name ?? "TBD"),
        score: s?.p2,
        winner: m.hasResult && (m.player2?.win ?? 0) > (m.player1?.win ?? 0),
      },
    ] as const,
  };
}

/**
 * Columns for one bracket. Double-elimination matches carry their own round
 * name (Winners Round 2, Losers Final, ...) off the match graph; anything else
 * is a plain single-elimination tree, where the round's size is what names it.
 */
function toTree(matches: BracketMatch[], named: boolean): BracketRound[] {
  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
  return rounds.map((round) => {
    const inRound = matches.filter((m) => m.round === round);
    return {
      label: named ? inRound[0].label : cutLabel(inRound.length),
      matches: inRound.map(toMatchNode),
    };
  });
}

function MatchRow({ match, showLabel }: { match: BracketMatch; showLabel?: boolean }) {
  return (
    <AdminRow className={`bracket${match.noShow ? " no-show" : ""}`}>
      <AdminRow.Main>
        <span className="admin-row__title">
          {match.player1?.name ?? "TBD"} vs {match.bye ? "Bye" : (match.player2?.name ?? "TBD")}
        </span>
        <span className="admin-row__meta">
          {showLabel ? `${match.label} · ` : ""}
          <MatchState match={match} />
        </span>
        {match.noShow ? (
          <span className="no-show__label">
            No-Show Report
            {match.noShow.autoResolvesAt ? (
              <>
                {" · decides in "}
                <Countdown to={match.noShow.autoResolvesAt} fallback="soon" urgentUnder={120} />
              </>
            ) : null}
          </span>
        ) : null}
        {match.contested ? <span className="no-show__label">Result contested</span> : null}
      </AdminRow.Main>
    </AdminRow>
  );
}

function Tree({ title, matches, named }: { title: string; matches: BracketMatch[]; named: boolean }) {
  if (matches.length === 0) return null;
  return (
    <section>
      <h3 className="section__subtitle">{title}</h3>
      <div className="bracket-scroll">
        <Bracket rounds={toTree(matches, named)} />
      </div>
    </section>
  );
}

/**
 * The public, full-width view of a bracket, drawn the way the format actually
 * works:
 *
 * - Swiss rounds are a list per round (pairings are recomputed every round, so
 *   there is no tree to draw).
 * - Double elimination is two trees plus the grand final, never one numeric
 *   sequence: its round numbers interleave the winners and losers halves, so
 *   ordering matches by round alone puts a losers-bracket duel in the middle
 *   of the winners bracket.
 * - Anything else (single elim, or the Top Cut after Swiss) is one tree.
 */
export default function TournamentBracket({ view }: { view: BracketView }) {
  const doubleElim = view.format === "double-elim";
  const swissRounds = [...new Set(view.matches.filter((m) => view.format === "swiss" && m.round <= view.stageOneRounds).map((m) => m.round))].sort(
    (a, b) => a - b,
  );

  if (doubleElim) {
    const winners = view.matches.filter((m) => m.bracket === "winners");
    const losers = view.matches.filter((m) => m.bracket === "losers");
    const grandFinal = view.matches.filter((m) => m.bracket === "grand-final");

    return (
      <>
        <Tree title="Winners bracket" matches={winners} named />
        <Tree title="Losers bracket" matches={losers} named />
        {grandFinal.length > 0 ? (
          <section>
            <h3 className="section__subtitle">Grand Final</h3>
            <AdminList>
              {grandFinal.map((m) => (
                <MatchRow key={m.id} match={m} showLabel />
              ))}
            </AdminList>
          </section>
        ) : null}
      </>
    );
  }

  const cutMatches = view.matches.filter((m) => !swissRounds.includes(m.round));

  return (
    <>
      {swissRounds.map((round) => (
        <section key={round}>
          <h3 className="section__subtitle">
            Round {round}
            {round === view.round && !view.clock.locked ? " · in progress" : ""}
          </h3>
          <AdminList>
            {view.matches
              .filter((m) => m.round === round)
              .map((m) => (
                <MatchRow key={m.id} match={m} />
              ))}
          </AdminList>
        </section>
      ))}

      <Tree
        title={view.format === "swiss" ? "Top Cut" : "Bracket"}
        matches={cutMatches}
        named={false}
      />
    </>
  );
}
