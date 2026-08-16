import type { Metadata } from "next";
import AdminList, { AdminRow } from "@/components/admin/AdminList";
import Footer from "@/components/site/Footer";
import SiteHeader from "@/components/site/SiteHeader";
import EmptyState from "@/components/ui/EmptyState";
import PageHeading from "@/components/ui/PageHeading";
import Wrap from "@/components/ui/Wrap";
import { getLeaderboard } from "@/lib/leaderboard";

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
      <SiteHeader />

      <main className="section" id="main">
        <Wrap>
          <PageHeading
            tab="Standings"
            title="Leaderboard"
            lede="Ranked by tournament points across completed REDU Format events - 3 per match win, 1 per draw, plus 5 for every top cut match won."
          />

          {rows.length === 0 ? (
            <EmptyState message="No completed tournaments yet. Rankings appear here once an admin finishes running one." />
          ) : (
            <AdminList className="leaderboard">
              {rows.map((row, i) => {
                const rank = i + 1;
                return (
                  <AdminRow className="leaderboard-row" key={row.playerId}>
                    <span
                      className={`leaderboard-row__rank${rank <= 3 ? " leaderboard-row__rank--top" : ""}`}
                    >
                      {TOP_BADGE[rank] ?? `#${rank}`}
                    </span>

                    <AdminRow.Main>
                      <span className="admin-row__title">{row.playerName}</span>
                      <span className="admin-row__meta">
                        {row.totalPoints} pts · {row.eventsPlayed}{" "}
                        {row.eventsPlayed === 1 ? "event" : "events"}
                      </span>
                    </AdminRow.Main>
                  </AdminRow>
                );
              })}
            </AdminList>
          )}
        </Wrap>
      </main>

      <Footer />
    </>
  );
}
