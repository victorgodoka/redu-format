import { NextResponse } from "next/server";
import { getLeaderboard, LEADERBOARD_PAGE_SIZE } from "@/lib/leaderboard";
import { cleanAvatar } from "@/lib/nexus-parse";

/**
 * Public, read-only leaderboard - the same rows /leaderboard renders, as JSON
 * for anyone who wants to show them elsewhere.
 *
 * Dynamic for the same reason the sitemap is: every other route reads the
 * session cookie and is dynamic already, and a route that queries at build
 * time makes the deploy depend on the database being up. Caching is done by
 * the response headers instead, where a CDN can absorb it - the standings only
 * change when a tournament completes.
 */
export const dynamic = "force-dynamic";

/** Nothing public gets to ask for an unbounded page. */
const MAX_LIMIT = 100;

function intParam(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const limit = Math.min(intParam(params.get("limit"), LEADERBOARD_PAGE_SIZE), MAX_LIMIT);
  const { rows, page, pages, total } = await getLeaderboard(intParam(params.get("page"), 1), limit);

  // Rank is the position on the whole board, not on this page.
  const firstRank = (page - 1) * limit + 1;

  return NextResponse.json(
    {
      page,
      pages,
      limit,
      total,
      players: rows.map((row, i) => ({
        rank: firstRank + i,
        name: row.playerName,
        // Rows stored before avatars were validated can hold junk; a public
        // API hands out a usable URL or nothing.
        avatar: cleanAvatar(row.avatarUrl) || null,
        points: row.totalPoints,
        events: row.eventsPlayed,
        wins: row.wins,
        losses: row.losses,
        bestPlacement: row.bestPlace,
      })),
    },
    {
      headers: {
        // Public data, meant to be read from other origins' browsers too.
        "Access-Control-Allow-Origin": "*",
        // Standings move only when a tournament completes, so a few minutes of
        // CDN cache costs nothing and keeps this off the connection pool.
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    },
  );
}
