"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAction } from "@/lib/audit-log";
import { getAdminSession } from "@/lib/auth/session";
import type { Structure } from "@/lib/events";
import {
  createTournament,
  deleteTournament,
  getTournament,
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

/** Every action here runs behind the admin middleware, so a session always exists. */
async function actor() {
  const session = await getAdminSession();
  return {
    actorId: session?.userId ?? "unknown",
    actorUsername: session?.username ?? "unknown",
    actorDisplayName: session?.displayName ?? "unknown",
  };
}

export async function createTournamentAction(
  _prev: TournamentFormState,
  form: FormData,
): Promise<TournamentFormState> {
  const draft = readDraft(form);
  if ("error" in draft) return draft;

  const tournament = await createTournament(draft);
  await recordAction({
    ...(await actor()),
    action: "tournament.create",
    target: tournament.slug,
    detail: `Created tournament "${tournament.name}" (${tournament.structure}, ${tournament.seats} seats)`,
  });

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

  const before = await getTournament(slug);
  const updated = await updateTournament(slug, { ...draft, taken });
  if (!updated) return { error: "That tournament no longer exists." };

  await recordAction({
    ...(await actor()),
    action: "tournament.update",
    target: updated.slug,
    detail: before
      ? `Updated tournament "${before.name}" -> "${updated.name}" (${before.taken}/${before.seats} -> ${updated.taken}/${updated.seats} seats)`
      : `Updated tournament "${updated.name}"`,
  });

  revalidatePath("/admin/tournaments");
  revalidatePath(`/admin/tournaments/${slug}`);
  revalidatePath("/events");
  redirect(`/admin/tournaments/${updated.slug}`);
}

export async function deleteTournamentAction(form: FormData) {
  const slug = String(form.get("slug") ?? "");
  const before = await getTournament(slug);
  const deleted = await deleteTournament(slug);

  if (deleted) {
    await recordAction({
      ...(await actor()),
      action: "tournament.delete",
      target: slug,
      detail: before
        ? `Deleted tournament "${before.name}" (had ${before.taken}/${before.seats} seats filled)`
        : `Deleted tournament "${slug}"`,
    });
  }

  revalidatePath("/admin/tournaments");
  revalidatePath("/events");
  redirect("/admin/tournaments");
}
