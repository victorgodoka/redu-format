"use server";

import { verifyTournament } from "@/lib/backend/services/duel-verification.service";

/** The tournament page's 1-minute client poll - see components/site/NexusPoll. */
export async function pollTournamentAction(slug: string) {
  await verifyTournament(slug).catch(() => null);
}
