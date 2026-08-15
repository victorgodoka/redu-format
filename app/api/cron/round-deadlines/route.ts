import { NextResponse } from "next/server";
import { closeAllOverdueMatches } from "@/lib/backend/services/results.service";

/**
 * Vercel Cron target (see vercel.json) - force-closes any match whose round
 * deadline has passed, across every tournament with an open bracket. There's
 * no persistent timer in serverless, so this polling sweep is what actually
 * enforces TournamentEvent.roundLimitDays.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const results = await closeAllOverdueMatches();
  return NextResponse.json({ results });
}
