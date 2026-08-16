import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getBracketView,
  getPlacings,
  type BracketPlayer,
} from "@/lib/backend/services/results.service";
import { getTournament } from "@/lib/tournaments";
import { completeBracketAction, nextRoundAction } from "./actions";
import MatchResultForm from "./match-result-form";
import StartBracketForm from "./start-bracket-form";

export const metadata: Metadata = {
  title: "Tournament bracket | REDU Format",
  robots: { index: false, follow: false },
};

/** The select's default for one side of an already-settled match: "draw" for a draw, else whoever has the higher win count. */
function resultOption(player: BracketPlayer, opponent: BracketPlayer): "1" | "0" | "draw" {
  if (player.draw > 0) return "draw";
  return player.win > opponent.win ? "1" : "0";
}

export default async function BracketPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const tournament = await getTournament(slug);
  if (!tournament) notFound();

  const view = await getBracketView(slug);
  const placings = view?.status === "complete" ? await getPlacings(slug) : [];

  const rounds = view
    ? [...new Set(view.matches.map((m) => m.round))].sort((a, b) => a - b)
    : [];
  const hasOpenMatches = view
    ? view.matches.some((m) => m.active && !m.hasResult && !m.bye)
    : false;

  return (
    <>
      <div className="admin-page-head">
        <h1 className="admin-heading">{tournament.name} · Bracket</h1>
        <Link className="admin-back" href={`/admin/tournaments/${slug}`}>
          ← Back to tournament
        </Link>
      </div>

      {!view ? (
        <div className="empty panel">
          <p className="lede">
            No bracket started yet. Starting one locks in the {tournament.taken}{" "}
            currently registered{" "}
            {tournament.taken === 1 ? "participant" : "participants"} as the
            field - anyone who registers afterward won&apos;t be added
            automatically.
          </p>
          <StartBracketForm slug={slug} />
        </div>
      ) : (
        <>
          <p className="lede">
            Status: {view.status} · Round {view.round}
          </p>

          {rounds.map((round) => (
            <div key={round}>
              <h2 className="section__subtitle">Round {round}</h2>
              <ul className="admin-list">
                {view.matches
                  .filter((m) => m.round === round)
                  .map((match) => (
                    <li className="admin-row panel bracket" key={match.id}>
                      <div className="admin-row__main">
                        <span className="admin-row__title">
                          {match.player1?.name ?? "TBD"} vs{" "}
                          {match.player2?.name ?? "Bye"}
                        </span>
                        {match.bye ? (
                          <span className="admin-row__meta">Bye</span>
                        ) : match.hasResult ? (
                          <span className="admin-row__meta">
                            {match.player1?.win ?? 0}-{match.player2?.win ?? 0}
                            {(match.player1?.draw ?? 0) > 0
                              ? ` (${match.player1?.draw} draws)`
                              : ""}
                          </span>
                        ) : match.disputed ? (
                          <span className="admin-row__meta">
                            Disputed - both players reported and disagree, needs
                            a mod
                          </span>
                        ) : match.reports.length === 1 ? (
                          <span className="admin-row__meta">
                            {match.player1?.registrationId ===
                            match.reports[0].registrationId
                              ? match.player1?.name
                              : match.player2?.name}{" "}
                            reported {match.reports[0].result} · waiting on the
                            other side
                          </span>
                        ) : (
                          <span className="admin-row__meta">
                            Awaiting result
                          </span>
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
                      </div>

                      {!match.bye &&
                      match.player1 &&
                      match.player2 &&
                      view.status !== "complete" ? (
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
                    </li>
                  ))}
              </ul>
            </div>
          ))}

          {view.status !== "complete" && !hasOpenMatches ? (
            <div className="dash-actions">
              <form action={nextRoundAction}>
                <input type="hidden" name="slug" value={slug} />
                <button className="btn" type="submit">
                  Generate next round
                </button>
              </form>
              <form action={completeBracketAction}>
                <input type="hidden" name="slug" value={slug} />
                <button className="btn btn--solid" type="submit">
                  Complete tournament
                </button>
              </form>
            </div>
          ) : null}

          <h2 className="section__subtitle">
            {view.status === "complete" ? "Final results" : "Current standings"}
          </h2>
          {view.status === "complete" ? (
            <ol className="admin-list">
              {placings.map((p) => (
                <li className="admin-row panel" key={p.registrationId}>
                  <div className="admin-row__main">
                    <span className="admin-row__title">
                      #{p.place} · {p.displayName}
                    </span>
                    <span className="admin-row__meta">{p.points} pts</span>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <ol className="admin-list">
              {view.standings.map((s, i) => (
                <li className="admin-row panel" key={s.registrationId}>
                  <div className="admin-row__main">
                    <span className="admin-row__title">
                      #{i + 1} · {s.name}
                      {s.dropped ? " (dropped)" : ""}
                    </span>
                    <span className="admin-row__meta">
                      {s.points} pts · {s.matchesPlayed} played
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </>
  );
}
