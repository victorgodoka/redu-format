import type { Metadata } from "next";
import { LEADERBOARD } from "@/lib/leaderboard";
import SiteHeader from "../site-header";

export const metadata: Metadata = {
  title: "REDU Format leaderboard | Duelist rankings",
  description:
    "Community rankings for REDU Format, by tournament points, wins and top cuts.",
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

export default function LeaderboardPage() {
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
            Ranked by tournament points across REDU Format events. Points come
            from event placements, weighted by field size.
          </p>

          <ul className="admin-list leaderboard">
            {LEADERBOARD.map((entry) => (
              <li className="admin-row leaderboard-row panel" key={entry.rank}>
                <span
                  className={`leaderboard-row__rank${
                    entry.rank <= 3 ? " leaderboard-row__rank--top" : ""
                  }`}
                >
                  {TOP_BADGE[entry.rank] ?? `#${entry.rank}`}
                </span>

                <div className="admin-row__main">
                  <span className="admin-row__title">{entry.name}</span>
                  <span className="admin-row__meta">
                    {entry.points} pts · {entry.wins}{" "}
                    {entry.wins === 1 ? "win" : "wins"} · {entry.topCuts} top{" "}
                    {entry.topCuts === 1 ? "cut" : "cuts"} · {entry.events}{" "}
                    {entry.events === 1 ? "event" : "events"} ·{" "}
                    {entry.signatureDeck}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </>
  );
}
