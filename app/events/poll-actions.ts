"use server";

import { verifyAllActiveTournaments } from "@/lib/backend/services/duel-verification.service";

/** The event-listing page's 5-minute client poll - see components/site/NexusPoll. */
export async function pollEventListAction() {
  await verifyAllActiveTournaments().catch(() => null);
}
