import type { ReactNode } from "react";
import AdminList, { AdminRow } from "@/components/admin/AdminList";
import MatchResultForm from "@/components/admin/MatchResultForm";
import type {
  BracketPlayer,
  BracketView,
  getPlacings,
} from "@/lib/backend/services/results.service";

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
  const rounds = [...new Set(view.matches.map((m) => m.round))].sort((a, b) => a - b);

  return (
    <>
      <p className="lede">
        Status: {view.status} · Round {view.round}
      </p>

      {rounds.map((round) => (
        <div key={round}>
          <h2 className="section__subtitle">Round {round}</h2>
          <AdminList>
            {view.matches
              .filter((m) => m.round === round)
              .map((match) => (
                <AdminRow key={match.id} className="bracket">
                  <AdminRow.Main>
                    <span className="admin-row__title">
                      {match.player1?.name ?? "TBD"} vs {match.player2?.name ?? "Bye"}
                    </span>
                    {match.bye ? (
                      <span className="admin-row__meta">Bye</span>
                    ) : match.hasResult ? (
                      <span className="admin-row__meta">
                        {match.player1?.win ?? 0}-{match.player2?.win ?? 0}
                        {(match.player1?.draw ?? 0) > 0 ? ` (${match.player1?.draw} draws)` : ""}
                      </span>
                    ) : match.disputed ? (
                      <span className="admin-row__meta">
                        Disputed - both players reported and disagree, needs a mod
                      </span>
                    ) : match.reports.length === 1 ? (
                      <span className="admin-row__meta">
                        {match.player1?.registrationId === match.reports[0].registrationId
                          ? match.player1?.name
                          : match.player2?.name}{" "}
                        reported {match.reports[0].result} · waiting on the other side
                      </span>
                    ) : (
                      <span className="admin-row__meta">Awaiting result</span>
                    )}
                    {match.roomHash ? (
                      <a
                        className="admin-row__meta"
                        href={`https://duelingnexus.com/duel/NA-${match.roomHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Room: NA-{match.roomHash}
                      </a>
                    ) : null}
                  </AdminRow.Main>

                  {!match.bye && match.player1 && match.player2 && view.status !== "complete" ? (
                    <MatchResultForm
                      slug={slug}
                      matchId={match.id}
                      hasResult={match.hasResult}
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
                  ) : null}
                </AdminRow>
              ))}
          </AdminList>
        </div>
      ))}

      {actions}

      <h2 className="section__subtitle">
        {view.status === "complete" ? "Final results" : "Current standings"}
      </h2>
      {view.status === "complete" ? (
        <AdminList as="ol">
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
