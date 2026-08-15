import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getBracketView, getPlacings } from "@/lib/backend/services/results.service";
import { getAdminSession } from "@/lib/auth/session";
import { getTournament } from "@/lib/tournaments";
import { completeBracketAction, enterResultAction, nextRoundAction } from "./actions";
import StartBracketForm from "./start-bracket-form";

export const metadata: Metadata = {
  title: "Tournament bracket | REDU Format",
  robots: { index: false, follow: false },
};

export default async function BracketPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await getAdminSession();
  if (!session) redirect("/admin");

  const tournament = await getTournament(slug);
  if (!tournament) notFound();

  const view = await getBracketView(slug);
  const placings = view?.status === "complete" ? await getPlacings(slug) : [];

  const rounds = view ? [...new Set(view.matches.map((m) => m.round))].sort((a, b) => a - b) : [];
  const hasOpenMatches = view ? view.matches.some((m) => m.active && !m.hasResult && !m.bye) : false;

  return (
    <main className="section" id="main">
      <div className="wrap">
        <div className="admin-bar">
          <p className="tab">Admin</p>
          <div className="admin-identity">
            <span>
              Signed in as {session.displayName} (@{session.username})
            </span>
            <Link className="admin-identity__link" href="/admin/dashboard">
              Admin home
            </Link>
            <Link className="admin-identity__link" href="/admin/tournaments">
              Manage tournaments
            </Link>
            <form action="/admin/logout" method="post">
              <button
                className="admin-identity__link admin-identity__signout"
                type="submit"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>

        <div className="admin-bar">
          <h1 className="section__title">{tournament.name} · Bracket</h1>
          <Link className="filters__reset" href={`/admin/tournaments/${slug}`}>
            ← Back to tournament
          </Link>
        </div>

        {!view ? (
          <div className="empty panel">
            <p className="lede">
              No bracket started yet. Starting one locks in the {tournament.taken}{" "}
              currently registered {tournament.taken === 1 ? "participant" : "participants"} as
              the field - anyone who registers afterward won&apos;t be added automatically.
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
                      <li className="admin-row panel" key={match.id}>
                        <div className="admin-row__main">
                          <span className="admin-row__title">
                            {match.player1?.name ?? "TBD"} vs {match.player2?.name ?? "Bye"}
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
                        </div>

                        {!match.bye && match.player1 && match.player2 && view.status !== "complete" ? (
                          <form action={enterResultAction} className="payment-controls__confirm">
                            <input type="hidden" name="slug" value={slug} />
                            <input type="hidden" name="matchId" value={match.id} />
                            <label>
                              {match.player1.name}
                              <input
                                type="number"
                                name="player1Wins"
                                min={0}
                                defaultValue={match.player1.win}
                                required
                              />
                            </label>
                            <label>
                              {match.player2.name}
                              <input
                                type="number"
                                name="player2Wins"
                                min={0}
                                defaultValue={match.player2.win}
                                required
                              />
                            </label>
                            <button className="btn btn--solid" type="submit">
                              {match.hasResult ? "Change result" : "Report"}
                            </button>
                          </form>
                        ) : null}
                      </li>
                    ))}
                </ul>
              </div>
            ))}

            {view.status !== "complete" && !hasOpenMatches ? (
              <div className="admin-bar">
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
      </div>
    </main>
  );
}
