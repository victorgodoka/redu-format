"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { findPlayerIdByToken } from "@/lib/backend/services/player.service";
import { findMyRegistrationId } from "@/lib/backend/services/registration.service";
import { submitMatchReport } from "@/lib/backend/services/results.service";

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

  revalidatePath(`/events/${slug}`);
  // The same card is rendered on the dashboard (components/site/MyRound), so
  // both places have to reflect the report.
  revalidatePath("/dashboard");
}
