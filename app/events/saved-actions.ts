"use server";

import { revalidatePath } from "next/cache";
import { getSession, MAX_SAVED_TOURNAMENTS } from "@/lib/auth";
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

  const saved = new Set(session.savedTournaments ?? []);
  saved.add(slug);
  session.savedTournaments = [...saved].slice(-MAX_SAVED_TOURNAMENTS);
  await session.save();

  revalidateSavedSurfaces(slug);
}

export async function unsaveTournamentAction(form: FormData) {
  const slug = readSlug(form);
  if (!slug) return;

  const session = await getSession();
  if (!session.token) return;

  session.savedTournaments = (session.savedTournaments ?? []).filter((s) => s !== slug);
  await session.save();

  revalidateSavedSurfaces(slug);
}
