"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Structure } from "@/lib/events";
import {
  createTournament,
  deleteTournament,
  updateTournament,
  type TournamentDraft,
} from "@/lib/tournaments";

export type TournamentFormState = { error?: string };

const STRUCTURES: readonly Structure[] = ["swiss", "single-elim", "mixed"];
const MATCH_FORMATS = ["Bo1", "Bo3"] as const;

function readDraft(form: FormData): TournamentDraft | { error: string } {
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };

  const startsAtLocal = String(form.get("startsAt") ?? "");
  const startsAtMs = new Date(startsAtLocal).getTime();
  if (!startsAtLocal || Number.isNaN(startsAtMs)) {
    return { error: "Pick a valid start date and time." };
  }

  const structure = String(form.get("structure") ?? "") as Structure;
  if (!STRUCTURES.includes(structure)) return { error: "Pick a structure." };

  const matchFormat = String(form.get("matchFormat") ?? "");
  if (!MATCH_FORMATS.includes(matchFormat as (typeof MATCH_FORMATS)[number])) {
    return { error: "Pick a match format." };
  }

  const rounds = Number(form.get("rounds"));
  const timeLimit = Number(form.get("timeLimit"));
  const seats = Number(form.get("seats"));
  const topCutRaw = String(form.get("topCut") ?? "").trim();
  const topCut = topCutRaw ? Number(topCutRaw) : null;

  if (!Number.isInteger(rounds) || rounds <= 0) {
    return { error: "Rounds must be a positive whole number." };
  }
  if (!Number.isInteger(timeLimit) || timeLimit <= 0) {
    return { error: "Time limit must be a positive whole number." };
  }
  if (!Number.isInteger(seats) || seats <= 0) {
    return { error: "Seats must be a positive whole number." };
  }
  if (topCut !== null && (!Number.isInteger(topCut) || topCut <= 0)) {
    return { error: "Top cut must be empty or a positive whole number." };
  }

  const entry = String(form.get("entry") ?? "").trim();
  const host = String(form.get("host") ?? "").trim();
  const signupUrl = String(form.get("signupUrl") ?? "").trim() || "#";
  if (!entry) return { error: "Entry is required." };
  if (!host) return { error: "Host is required." };

  return {
    name,
    startsAt: new Date(startsAtMs).toISOString(),
    structure,
    rounds,
    topCut,
    matchFormat: matchFormat as (typeof MATCH_FORMATS)[number],
    timeLimit,
    seats,
    entry,
    host,
    signupUrl,
  };
}

export async function createTournamentAction(
  _prev: TournamentFormState,
  form: FormData,
): Promise<TournamentFormState> {
  const draft = readDraft(form);
  if ("error" in draft) return draft;

  const tournament = await createTournament(draft);
  revalidatePath("/admin/tournaments");
  revalidatePath("/events");
  redirect(`/admin/tournaments/${tournament.slug}`);
}

export async function updateTournamentAction(
  _prev: TournamentFormState,
  form: FormData,
): Promise<TournamentFormState> {
  const slug = String(form.get("slug") ?? "");
  const draft = readDraft(form);
  if ("error" in draft) return draft;

  const taken = Number(form.get("taken"));
  if (!Number.isInteger(taken) || taken < 0) {
    return { error: "Seats taken must be zero or a positive whole number." };
  }

  const updated = await updateTournament(slug, { ...draft, taken });
  if (!updated) return { error: "That tournament no longer exists." };

  revalidatePath("/admin/tournaments");
  revalidatePath(`/admin/tournaments/${slug}`);
  revalidatePath("/events");
  redirect(`/admin/tournaments/${updated.slug}`);
}

export async function deleteTournamentAction(form: FormData) {
  const slug = String(form.get("slug") ?? "");
  await deleteTournament(slug);
  revalidatePath("/admin/tournaments");
  revalidatePath("/events");
  redirect("/admin/tournaments");
}
