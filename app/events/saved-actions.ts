"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { findPlayerIdByToken } from "@/lib/backend/services/player.service";
import { saveTournament, unsaveTournament } from "@/lib/backend/services/registration.service";
import { FEATURED_EVENT, pastEvents } from "@/lib/events";
import { getTournament } from "@/lib/tournaments";

function readSlug(form: FormData): string | null {
  const slug = String(form.get("slug") ?? "").trim();
  return /^[a-z0-9-]{1,128}$/.test(slug) ? slug : null;
}

/** Shared by every page that renders a save toggle, so they stay in sync. */
function revalidateSavedSurfaces(slug: string) {
  revalidatePath("/events");
  revalidatePath(`/events/${slug}`);
  revalidatePath("/dashboard");
}

async function isKnownTournament(slug: string): Promise<boolean> {
  if (slug === FEATURED_EVENT.slug) return true;
  if (pastEvents.some((event) => event.slug === slug)) return true;
  return (await getTournament(slug)) !== null;
}

export async function saveTournamentAction(form: FormData) {
  const slug = readSlug(form);
  if (!slug) return;

  const session = await getSession();
  if (!session.token) return;
  if (!(await isKnownTournament(slug))) return;

  // Read-only: a player row exists for any session that has ever logged in,
  // registered or saved since this shipped. A pre-existing cookie without one
  // yet self-heals on its next login/refresh/register, so this stays a cheap
  // lookup instead of fetching the Nexus profile just to upsert on every click.
  const playerId = await findPlayerIdByToken(session.token);
  if (!playerId) return;

  await saveTournament(playerId, slug);

  revalidateSavedSurfaces(slug);
}

export async function unsaveTournamentAction(form: FormData) {
  const slug = readSlug(form);
  if (!slug) return;

  const session = await getSession();
  if (!session.token) return;

  const playerId = await findPlayerIdByToken(session.token);
  if (!playerId) return;

  await unsaveTournament(playerId, slug);

  revalidateSavedSurfaces(slug);
}
