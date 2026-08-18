import Bracket, { type BracketRound } from "@/components/site/Bracket";
import AdminList, { AdminRow } from "@/components/admin/AdminList";
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

function toTree(rounds: number[], matches: BracketMatch[]): BracketRound[] {
  return rounds.map((round) => {
    const inRound = matches.filter((m) => m.round === round);
    return {
      label: cutLabel(inRound.length),
      matches: inRound.map((m) => {
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
      }),
    };
  });
}

function MatchRow({ match }: { match: BracketMatch }) {
  const s = score(match);
  return (
    <AdminRow className="bracket">
      <AdminRow.Main>
        <span className="admin-row__title">
          {match.player1?.name ?? "TBD"} vs {match.bye ? "Bye" : (match.player2?.name ?? "TBD")}
        </span>
        <span className="admin-row__meta">
          {match.bye
            ? "Automatic win"
            : s
              ? `${s.p1}-${s.p2}`
              : match.disputed
                ? "Disputed - waiting on a Tournament Organizer"
                : "In progress"}
        </span>
      </AdminRow.Main>
    </AdminRow>
  );
}

/**
 * The public, full-width view of a bracket. Swiss rounds are a plain list per
 * round (they are not a tree - pairings are recomputed every round), while an
 * elimination stage - a whole single/double-elim event, or the Top Cut after
 * Swiss - renders as the actual bracket tree.
 */
export default function TournamentBracket({ view }: { view: BracketView }) {
  const rounds = [...new Set(view.matches.map((m) => m.round))].sort((a, b) => a - b);
  const swissRounds = rounds.filter((r) => view.format === "swiss" && r <= view.stageOneRounds);
  const cutRounds = rounds.filter((r) => !swissRounds.includes(r));

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

      {cutRounds.length > 0 ? (
        <section>
          <h3 className="section__subtitle">
            {view.format === "swiss" ? "Top Cut" : "Bracket"}
          </h3>
          <div className="bracket-scroll">
            <Bracket rounds={toTree(cutRounds, view.matches)} />
          </div>
        </section>
      ) : null}
    </>
  );
}
