import type { Metadata } from "next";
import Footer from "@/components/site/Footer";
import SiteHeader from "@/components/site/SiteHeader";
import EmptyState from "@/components/ui/EmptyState";
import FallbackImage from "@/components/ui/FallbackImage";
import Pager from "@/components/ui/Pager";
import PageHeading from "@/components/ui/PageHeading";
import Panel from "@/components/ui/Panel";
import Wrap from "@/components/ui/Wrap";
import { getLeaderboard, LEADERBOARD_PAGE_SIZE } from "@/lib/leaderboard";
import { DEFAULT_AVATAR } from "@/lib/nexus-parse";

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

/** "4th", "21st" - the best finish a duelist has to their name. */
function ordinal(place: number): string {
  const rest = place % 100;
  if (rest >= 11 && rest <= 13) return `${place}th`;
  return `${place}${["th", "st", "nd", "rd"][place % 10] ?? "th"}`;
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: rawPage } = await searchParams;
  const { rows, page, pages, total } = await getLeaderboard(
    Number.parseInt(rawPage ?? "1", 10) || 1,
  );
  // Rank is the row's position on the whole board, not on this page.
  const firstRank = (page - 1) * LEADERBOARD_PAGE_SIZE + 1;

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

          {total === 0 ? (
            <EmptyState message="No completed tournaments yet. Rankings appear here once an admin finishes running one." />
          ) : (
            <>
              <Panel className="leaderboard">
                <div className="leaderboard__scroll">
                  <table className="leaderboard__table">
                  <thead>
                    <tr>
                      <th scope="col">Rank</th>
                      <th scope="col">Duelist</th>
                      <th scope="col">Points</th>
                      <th scope="col">Events</th>
                      <th scope="col">W/L</th>
                      <th scope="col">Best</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const rank = firstRank + i;
                      return (
                        <tr key={row.playerId}>
                          <td
                            className={`leaderboard-row__rank${rank <= 3 ? " leaderboard-row__rank--top" : ""}`}
                          >
                            {TOP_BADGE[rank] ?? `#${rank}`}
                          </td>
                          <td>
                            <span className="leaderboard__duelist">
                              <FallbackImage
                                className="leaderboard__avatar"
                                src={row.avatarUrl || DEFAULT_AVATAR}
                                fallbackSrc={DEFAULT_AVATAR}
                                alt=""
                                width={32}
                                height={32}
                              />
                              {row.playerName}
                            </span>
                          </td>
                          <td className="leaderboard__num">{row.totalPoints}</td>
                          <td className="leaderboard__num">{row.eventsPlayed}</td>
                          <td className="leaderboard__num">
                            {row.wins}/{row.losses}
                          </td>
                          <td className="leaderboard__num">{ordinal(row.bestPlace)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  </table>
                </div>
              </Panel>

              <Pager page={page} pages={pages} hrefFor={(n) => `/leaderboard?page=${n}`} />
            </>
          )}
        </Wrap>
      </main>

      <Footer />
    </>
  );
}
