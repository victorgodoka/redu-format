import type { ReactNode } from "react";
import AdminList, { AdminRow } from "@/components/admin/AdminList";
import MatchResultForm from "@/components/admin/MatchResultForm";
import Button from "@/components/ui/Button";
import Countdown from "@/components/site/Countdown";
import {
  dismissNoShowAdminAction,
  swapPlayersAction,
} from "@/app/admin/(protected)/tournaments/[slug]/bracket/actions";
import type {
  BracketPlayer,
  BracketView,
  getPlacings,
} from "@/lib/backend/services/results.service";
import { NEXUS_LOBBY_URL } from "@/lib/nexus-parse";

type Placing = Awaited<ReturnType<typeof getPlacings>>[number];

/** The select's default for one side of an already-settled match: "draw" for a draw, else whoever has the higher win count. */
function resultOption(player: BracketPlayer, opponent: BracketPlayer): "1" | "0" | "draw" {
  if (player.draw > 0) return "draw";
  return player.win > opponent.win ? "1" : "0";
}

export default function BracketRounds({
  slug,
  view,
  placings,
  actions,
}: {
  slug: string;
  view: BracketView;
  placings: Placing[];
  /** Rendered between the rounds and the standings/final-results list (e.g. "generate next round"). */
  actions?: ReactNode;
}) {
  /**
   * Double elimination numbers its rounds by bracket half, not chronologically
   * (winners 1-3, grand final 4, losers 5-8 for an 8-player field), so the
   * rounds are ordered by the side they belong to and titled with the name the
   * match itself carries - never a bare "Round 5" that reads like it comes
   * after the grand final.
   */
  const SIDE_ORDER = { winners: 0, losers: 1, "grand-final": 2 } as const;
  const rounds = [...new Set(view.matches.map((m) => m.round))].sort((a, b) => {
    const side = (round: number) => {
      const bracket = view.matches.find((m) => m.round === round)?.bracket;
      return bracket ? SIDE_ORDER[bracket] : 0;
    };
    return side(a) - side(b) || a - b;
  });
  const titleFor = (round: number) =>
    view.matches.find((m) => m.round === round)?.label ?? `Round ${round}`;

  // Every player currently sitting in an open, unreported match - the pool a
  // swap can pull from. Swapping only ever makes sense between two matches
  // that are both still to be played.
  const swappable = view.matches.filter(
    (m) => m.active && !m.bye && !m.hasResult && m.player1 && m.player2,
  );

  return (
    <>
      {view.status === "complete" ? <p className="lede">Tournament complete.</p> : null}

      {rounds.map((round) => (
        <div key={round} className="bracket-round">
          <h2 className="bracket-round__title">{titleFor(round)}</h2>
          <AdminList className="bracket-round__matches">
            {view.matches
              .filter((m) => m.round === round)
              .map((match) => {
                const p1Wins =
                  match.hasResult && match.player1 && match.player2 && match.player1.win > match.player2.win;
                const p2Wins =
                  match.hasResult && match.player1 && match.player2 && match.player2.win > match.player1.win;
                return (
                  <AdminRow key={match.id} className={`bracket${match.noShow ? " no-show" : ""}`}>
                    <AdminRow.Main>
                      <div className="matchup">
                        <div className={`matchup__side${p1Wins ? " matchup__side--winner" : ""}`}>
                          <span className="matchup__name">{match.player1?.name ?? "TBD"}</span>
                          {match.hasResult ? (
                            <span className="matchup__score">{match.player1?.win ?? 0}</span>
                          ) : null}
                        </div>
                        <span className="matchup__vs">vs</span>
                        <div className={`matchup__side${p2Wins ? " matchup__side--winner" : ""}`}>
                          <span className="matchup__name">{match.bye ? "Bye" : (match.player2?.name ?? "TBD")}</span>
                          {match.hasResult ? (
                            <span className="matchup__score">{match.player2?.win ?? 0}</span>
                          ) : null}
                        </div>
                      </div>
                      {match.bye ? (
                        <span className="badge badge--neutral">Bye</span>
                      ) : match.hasResult ? (
                        <span className="badge badge--positive">
                          Final{(match.player1?.draw ?? 0) > 0 ? ` · ${match.player1?.draw} draws` : ""}
                        </span>
                      ) : match.reports.length >= 1 ? (
                        <span className="badge badge--neutral">
                          Reported by{" "}
                          {match.player1?.registrationId === match.reports[0].registrationId
                            ? match.player1?.name
                            : match.player2?.name}{" "}
                          · {match.reports[0].winnerGames}-{match.reports[0].loserGames}
                        </span>
                      ) : match.active && match.deadlineAt ? (
                        <span className="badge badge--neutral">
                          Awaiting result · <Countdown to={match.deadlineAt} fallback="open" /> left
                        </span>
                      ) : (
                        <span className="badge badge--neutral">Awaiting result</span>
                      )}
                      {match.noShow ? (
                        <span className="no-show__label">
                          No-Show Report
                          {match.noShow.autoResolvesAt ? (
                            <>
                              {" · decides in "}
                              <Countdown to={match.noShow.autoResolvesAt} fallback="soon" urgentUnder={120} />
                            </>
                          ) : (
                            " · waiting on you"
                          )}
                        </span>
                      ) : null}
                      {match.contested ? (
                        <span className="no-show__label">Result contested - a player asked for a review</span>
                      ) : null}
                      {match.roomHash ? (
                        <a
                          className="admin-row__meta"
                          href={`${NEXUS_LOBBY_URL}}/NA-${match.roomHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Room: NA-{match.roomHash}
                        </a>
                      ) : null}
                    </AdminRow.Main>

                    {match.noShow ? (
                      <AdminRow.Actions>
                        <form action={dismissNoShowAdminAction}>
                          <input type="hidden" name="slug" value={slug} />
                          <input type="hidden" name="matchId" value={match.id} />
                          <Button type="submit">Dismiss no-show</Button>
                        </form>
                      </AdminRow.Actions>
                    ) : null}

                    {!match.bye && match.player1 && match.player2 && view.status !== "complete" ? (
                      <>
                        <MatchResultForm
                          slug={slug}
                          matchId={match.id}
                          hasResult={match.hasResult}
                          winningGames={view.winningGames}
                          player1={{
                            name: match.player1.name,
                            defaultValue: match.hasResult
                              ? resultOption(match.player1, match.player2)
                              : "0",
                          }}
                          player2={{
                            name: match.player2.name,
                            defaultValue: match.hasResult
                              ? resultOption(match.player2, match.player1)
                              : "0",
                          }}
                        />
                        {!match.hasResult && match.active && swappable.length > 1 ? (
                          <AdminRow.Actions>
                            <details className="admin-row__override">
                              <summary className="admin-row__meta">Swap opponent</summary>
                              <form action={swapPlayersAction} className="payment-controls__confirm">
                                <input type="hidden" name="slug" value={slug} />
                                <select name="playerAId" aria-label="Player to move" required defaultValue="">
                                  <option value="" disabled>
                                    Move...
                                  </option>
                                  <option value={match.player1.registrationId}>{match.player1.name}</option>
                                  <option value={match.player2.registrationId}>{match.player2.name}</option>
                                </select>
                                <select name="playerBId" aria-label="Swap with" required defaultValue="">
                                  <option value="" disabled>
                                    Swap with...
                                  </option>
                                  {swappable
                                    .filter((m) => m.id !== match.id)
                                    .flatMap((m) => [
                                      { id: m.player1!.registrationId, name: m.player1!.name, opponent: m.player2!.name },
                                      { id: m.player2!.registrationId, name: m.player2!.name, opponent: m.player1!.name },
                                    ])
                                    .map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.name} (vs {p.opponent})
                                      </option>
                                    ))}
                                </select>
                                <Button variant="danger" type="submit">
                                  Swap
                                </Button>
                              </form>
                            </details>
                          </AdminRow.Actions>
                        ) : null}
                      </>
                    ) : null}
                  </AdminRow>
                );
              })}
          </AdminList>
        </div>
      ))}

      {actions}

      <div className="standings-heading">
        <h2 className="section__subtitle">
          {view.status === "complete" ? "Final results" : "Current standings"}
        </h2>
      </div>
      {view.status === "complete" ? (
        <AdminList className="participants" as="ol">
          {placings.map((p) => (
            <AdminRow key={p.registrationId}>
              <AdminRow.Main>
                <span className="admin-row__title">
                  #{p.place} · {p.displayName}
                </span>
                <span className="admin-row__meta">{p.points} pts</span>
              </AdminRow.Main>
            </AdminRow>
          ))}
        </AdminList>
      ) : (
        <AdminList className="participants" as="ol">
          {view.standings.map((s, i) => (
            <AdminRow key={s.registrationId}>
              <AdminRow.Main>
                <span className="admin-row__title">
                  #{i + 1} · {s.name}
                  {s.dropped ? " (dropped)" : ""}
                </span>
                <span className="admin-row__meta">
                  {s.points} pts · {s.matchesPlayed} played
                </span>
              </AdminRow.Main>
            </AdminRow>
          ))}
        </AdminList>
      )}
    </>
  );
}
