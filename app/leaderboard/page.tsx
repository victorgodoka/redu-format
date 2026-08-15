import type { Metadata } from "next";
import { getLeaderboard } from "@/lib/leaderboard";
import SiteHeader from "../site-header";

export const metadata: Metadata = {
  title: "REDU Format leaderboard | Duelist rankings",
  description: "Community rankings for REDU Format, by tournament points.",
  alternates: { canonical: "/leaderboard" },
  openGraph: {
    type: "website",
    url: "/leaderboard",
    siteName: "REDU Format",
    title: "REDU Format leaderboard | Duelist rankings",
    description: "Community rankings for REDU Format, by tournament points.",
  },
};

/** Trophy tiers for the top of the board; everyone else just gets a number. */
const TOP_BADGE: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd" };

export default async function LeaderboardPage() {
  const rows = await getLeaderboard();

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <SiteHeader />

      <main className="section" id="main">
        <div className="wrap">
          <p className="tab">Standings</p>
          <h1 className="section__title">Leaderboard</h1>
          <p className="lede">
            Ranked by tournament points across completed REDU Format events - 3 per
            match win, 1 per draw, plus 5 for every top cut match won.
          </p>

          {rows.length === 0 ? (
            <div className="empty panel">
              <p className="lede">
                No completed tournaments yet. Rankings appear here once an admin
                finishes running one.
              </p>
            </div>
          ) : (
            <ul className="admin-list leaderboard">
              {rows.map((row, i) => {
                const rank = i + 1;
                return (
                  <li className="admin-row leaderboard-row panel" key={row.playerId}>
                    <span
                      className={`leaderboard-row__rank${
                        rank <= 3 ? " leaderboard-row__rank--top" : ""
                      }`}
                    >
                      {TOP_BADGE[rank] ?? `#${rank}`}
                    </span>

                    <div className="admin-row__main">
                      <span className="admin-row__title">{row.playerName}</span>
                      <span className="admin-row__meta">
                        {row.totalPoints} pts · {row.eventsPlayed}{" "}
                        {row.eventsPlayed === 1 ? "event" : "events"}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}
