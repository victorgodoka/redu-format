import Link from "next/link";
import { Fragment } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Countdown from "@/components/site/Countdown";
import MatchResultForm from "@/components/admin/MatchResultForm";
import SwapChip from "@/components/admin/SwapChip";
import StandingsTable from "@/components/site/StandingsTable";
import { dismissNoShowAdminAction } from "@/app/admin/(protected)/tournaments/[slug]/bracket/actions";
import type { BracketMatch, BracketView, PlacingWithTiebreak } from "@/lib/backend/services/results.service";

/**
 * Swiss + Top Cut admin bracket workspace: a Bracket/Standings tab pair, a
 * round-pill selector (plus a Top Cut pill once one is configured), and
 * expandable match cards whose name chips double as a drag-and-drop swap
 * control (see SwapChip). Every action here is the same server action the
 * page already used before this view existed - this only changes how they're
 * laid out and triggered.
 */
export default function SwissBracketView({
  slug,
  view,
  placings,
  topCut,
  tab,
  round,
}: {
  slug: string;
  view: BracketView;
  placings: PlacingWithTiebreak[];
  /** Configured Top Cut size (e.g. 4, 8, 16), or null when this event has none - for the standings cut line. */
  topCut: number | null;
  tab: "bracket" | "standings";
  round: string;
}) {
  const hasTopCut = view.topCutFormat !== null;
  const roundKeys = Array.from({ length: view.stageOneRounds }, (_, i) => String(i + 1));

  return (
    <>
      <nav className="bracket-tabs">
        <Link href="?tab=bracket" className={`bracket-tab${tab === "bracket" ? " bracket-tab--active" : ""}`}>
          Bracket
        </Link>
        <Link href="?tab=standings" className={`bracket-tab${tab === "standings" ? " bracket-tab--active" : ""}`}>
          Standings
        </Link>
      </nav>

      {tab === "standings" ? (
        <StandingsPanel view={view} placings={placings} topCut={topCut} />
      ) : (
        <>
          <div className="round-pills">
            {roundKeys.map((r) => (
              <Link
                key={r}
                href={`?tab=bracket&round=${r}`}
                className={`round-pill${round === r ? " round-pill--active" : ""}`}
              >
                Round {r}
              </Link>
            ))}
            {hasTopCut ? (
              <>
                <span className="round-pills__divider" />
                <Link
                  href="?tab=bracket&round=topcut"
                  className={`round-pill${round === "topcut" ? " round-pill--active" : ""}`}
                >
                  Top Cut
                </Link>
              </>
            ) : null}
          </div>

          {round === "topcut" ? (
            <TopCutPanel slug={slug} view={view} />
          ) : (
            <RoundPanel slug={slug} view={view} round={Number(round)} />
          )}
        </>
      )}
    </>
  );
}

function RoundPanel({ slug, view, round }: { slug: string; view: BracketView; round: number }) {
  const matches = view.matches.filter((m) => m.round === round);
  if (matches.length === 0) {
    return (
      <div className="locked-round">
        {round <= 1
          ? "This round hasn't been paired yet."
          : `Round ${round} pairings appear once Round ${round - 1} closes.`}
      </div>
    );
  }
  return <MatchCardList slug={slug} matches={matches} winningGames={view.winningGames} />;
}

function TopCutPanel({ slug, view }: { slug: string; view: BracketView }) {
  const cutMatches = view.matches.filter((m) => m.round > view.stageOneRounds);
  if (cutMatches.length === 0) {
    return <div className="locked-round">{`Top Cut locks in once Round ${view.stageOneRounds} closes.`}</div>;
  }
  const rounds = [...new Set(cutMatches.map((m) => m.round))].sort((a, b) => a - b);
  return (
    <>
      {rounds.map((r) => {
        const inRound = cutMatches.filter((m) => m.round === r);
        return (
          <div key={r} className="bracket-round">
            <h3 className="bracket-round__title">{inRound[0].label}</h3>
            <MatchCardList slug={slug} matches={inRound} winningGames={view.winningGames} />
          </div>
        );
      })}
    </>
  );
}

function MatchCardList({
  slug,
  matches,
  winningGames,
}: {
  slug: string;
  matches: BracketMatch[];
  winningGames: number;
}) {
  return (
    <>
      {matches.map((match) => (
        <MatchCard key={match.id} slug={slug} match={match} winningGames={winningGames} />
      ))}
    </>
  );
}

/** The select's default for one side of an already-settled match: "draw" for a draw, else whoever has the higher win count. */
function resultOption(player: BracketMatch["player1"], opponent: BracketMatch["player1"]): "1" | "0" | "draw" {
  if (!player || !opponent) return "0";
  if (player.draw > 0) return "draw";
  return player.win > opponent.win ? "1" : "0";
}

function MatchCard({
  slug,
  match,
  winningGames,
}: {
  slug: string;
  match: BracketMatch;
  winningGames: number;
}) {
  if (match.bye || !match.player1 || !match.player2) {
    return (
      <div className="match-card">
        <div className="match-card__header">
          <span />
          <span className="matchup__name">{match.player1?.name ?? "TBD"}</span>
          <span />
          <span className="matchup__name">{match.bye ? "Bye" : "TBD"}</span>
          <Badge tone={match.bye ? "positive" : "neutral"}>{match.bye ? "Bye" : "Awaiting"}</Badge>
        </div>
      </div>
    );
  }

  const p1Wins = match.hasResult && match.player1.win > match.player2.win;
  const p2Wins = match.hasResult && match.player2.win > match.player1.win;

  return (
    <details className="match-card">
      <summary className="match-card__header">
        <span className="match-card__chevron">›</span>
        <SwapChip slug={slug} playerId={match.player1.registrationId} name={match.player1.name} winner={p1Wins} disabled={match.hasResult} />
        <span className="match-card__score">
          <span className={p1Wins ? "match-card__score--winner" : ""}>{match.hasResult ? match.player1.win : "–"}</span>
          <span>–</span>
          <span className={p2Wins ? "match-card__score--winner" : ""}>{match.hasResult ? match.player2.win : "–"}</span>
        </span>
        <SwapChip slug={slug} playerId={match.player2.registrationId} name={match.player2.name} winner={p2Wins} disabled={match.hasResult} />
        {match.hasResult ? (
          <Badge tone="positive">Final</Badge>
        ) : match.active && match.deadlineAt ? (
          <Badge tone="neutral">
            Awaiting · <Countdown to={match.deadlineAt} fallback="open" />
          </Badge>
        ) : (
          <Badge tone="neutral">Awaiting</Badge>
        )}
      </summary>

      <div className="match-card__body">
        {match.roomHash ? (
          <div>
            <div className="match-card__room-label">Room</div>
            <div className="match-card__room">NA-{match.roomHash}</div>
          </div>
        ) : null}

        {match.noShow ? (
          <div>
            <div className="match-card__room-label">No-show reported</div>
            <form action={dismissNoShowAdminAction}>
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="matchId" value={match.id} />
              <Button type="submit" variant="quiet">
                Dismiss
                {match.noShow.autoResolvesAt ? (
                  <>
                    {" "}
                    · decides in <Countdown to={match.noShow.autoResolvesAt} fallback="soon" urgentUnder={120} />
                  </>
                ) : null}
              </Button>
            </form>
          </div>
        ) : null}

        <MatchResultForm
          slug={slug}
          matchId={match.id}
          hasResult={match.hasResult}
          winningGames={winningGames}
          player1={{
            name: match.player1.name,
            defaultValue: match.hasResult ? resultOption(match.player1, match.player2) : "0",
          }}
          player2={{
            name: match.player2.name,
            defaultValue: match.hasResult ? resultOption(match.player2, match.player1) : "0",
          }}
        />
      </div>
    </details>
  );
}

function StandingsPanel({
  view,
  placings,
  topCut,
}: {
  view: BracketView;
  placings: PlacingWithTiebreak[];
  topCut: number | null;
}) {
  if (view.status === "complete") {
    return <StandingsTable rows={placings} />;
  }
  return <LiveStandingsTable standings={view.standings} topCut={topCut} />;
}

function LiveStandingsTable({
  standings,
  topCut,
}: {
  standings: BracketView["standings"];
  topCut: number | null;
}) {
  return (
    <table className="leaderboard__table">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Player</th>
          <th>Pts</th>
          <th>Played</th>
        </tr>
      </thead>
      <tbody>
        {standings.map((s, i) => (
          <Fragment key={s.registrationId}>
            {topCut !== null && i === topCut && standings.length > topCut ? (
              <tr>
                <td colSpan={4} style={{ borderBottom: "none", padding: 0 }}>
                  <div className="standings-cut-line">
                    <span className="standings-cut-line__rule" />
                    <span className="standings-cut-line__label">Top {topCut} advance to Top Cut</span>
                    <span className="standings-cut-line__rule" />
                  </div>
                </td>
              </tr>
            ) : null}
            <tr>
              <td className={i === 0 ? "leaderboard-row__rank leaderboard-row__rank--top" : "leaderboard-row__rank"}>
                #{i + 1}
              </td>
              <td>
                {s.name}
                {s.dropped ? " (dropped)" : ""}
              </td>
              <td>{s.points}</td>
              <td>{s.matchesPlayed}</td>
            </tr>
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
