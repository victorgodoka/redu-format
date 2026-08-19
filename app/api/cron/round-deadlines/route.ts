import { NextResponse } from "next/server";
import { closeAllOverdueMatches, resolveDueNoShows } from "@/lib/backend/services/results.service";

/**
 * Vercel Cron target (see vercel.json) - force-closes any match whose round
 * deadline has passed, across every tournament with an open bracket, and pairs
 * the next round of a same-day tournament once its cleanup window is over.
 *
 * On the Hobby plan this can only run once a day, which is enough for a
 * long-duration tournament's multi-day deadlines but nowhere near a same-day
 * tournament's 50-minute rounds. So this is the backstop, not the main clock:
 * the same sweep also runs whenever someone touches a live tournament (the
 * event page, the dashboard, the admin bracket page, and every player report),
 * and the round lock itself is computed from persisted deadlines, so reporting
 * closes on time whether or not anything has swept yet.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const noShows = await resolveDueNoShows();
  const results = await closeAllOverdueMatches();
  return NextResponse.json({ noShows, results });
}
