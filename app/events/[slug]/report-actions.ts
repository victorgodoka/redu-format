"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { findPlayerIdByToken } from "@/lib/backend/services/player.service";
import { findMyRegistrationId } from "@/lib/backend/services/registration.service";
import { closeOverdueMatches, submitMatchReport } from "@/lib/backend/services/results.service";

const RESULTS = ["win", "loss", "draw"] as const;

/** Fire-and-forget, like the other bracket forms: a rejected report (wrong match, already resolved) is just a no-op on the page. */
export async function submitMatchReportAction(form: FormData) {
  const slug = String(form.get("slug") ?? "");
  const matchId = String(form.get("matchId") ?? "");
  const result = String(form.get("result") ?? "");
  if (!slug || !matchId || !RESULTS.includes(result as (typeof RESULTS)[number])) return;

  const session = await getSession();
  if (!session.token) return;
  const playerId = await findPlayerIdByToken(session.token);
  if (!playerId) return;
  const registrationId = await findMyRegistrationId(slug, playerId);
  if (!registrationId) return;

  try {
    await submitMatchReport(slug, matchId, registrationId, result as (typeof RESULTS)[number]);
  } catch {
    return;
  }

  // The deploy target only allows one cron run a day (see the cron route), so
  // round transitions ride on requests as well: reporting is the most frequent
  // thing that happens during a live tournament, which makes it the best place
  // to notice that the round it belongs to has since locked or run out its
  // cleanup window. Best-effort - the report itself already landed.
  await closeOverdueMatches(slug).catch(() => null);

  revalidatePath(`/events/${slug}`);
  // The same card is rendered on the dashboard (components/site/MyRound), so
  // both places have to reflect the report.
  revalidatePath("/dashboard");
}
