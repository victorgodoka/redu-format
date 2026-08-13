"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAction } from "@/lib/audit-log";
import { getAdminSession } from "@/lib/auth/session";
import { recommendedTopCut, SEAT_OPTIONS, type Structure } from "@/lib/events";
import {
  createTournament,
  deleteTournament,
  getTournament,
  slugify,
  updateTournament,
  type TournamentDraft,
} from "@/lib/tournaments";

export type TournamentFormState = { error?: string };

const STRUCTURES: readonly Structure[] = ["swiss", "single-elim", "double-elim"];
const MATCH_FORMATS = ["Bo1", "Bo3"] as const;

function readDraft(form: FormData): TournamentDraft | { error: string } {
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };

  const date = String(form.get("startsAtDate") ?? "");
  const time = String(form.get("startsAtTime") ?? "");
  const startsAtMs = new Date(`${date}T${time}`).getTime();
  if (!date || !time || Number.isNaN(startsAtMs)) {
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
  if (!Number.isInteger(rounds) || rounds <= 0) {
    return { error: "Rounds must be a positive whole number." };
  }
  if (!Number.isInteger(timeLimit) || timeLimit <= 0) {
    return { error: "Time limit must be a positive whole number." };
  }

  const seatsRaw = String(form.get("seats") ?? "");
  let seats: number | null;
  if (seatsRaw === "unlimited") {
    seats = null;
  } else {
    seats = Number(seatsRaw);
    if (!SEAT_OPTIONS.includes(seats as (typeof SEAT_OPTIONS)[number])) {
      return { error: "Pick a seat count." };
    }
  }

  // The bracket size is always derived from the field size (see
  // recommendedTopCut), never typed in directly, so the on-screen suggestion
  // and the stored value can never drift apart. Unlimited fields cannot be
  // sized yet, so they stay null until real signups exist to size against.
  const hasTopCut = form.get("hasTopCut") === "on";
  const topCut =
    structure === "swiss" && hasTopCut && seats !== null ? recommendedTopCut(seats) : null;

  const entryType = String(form.get("entryType") ?? "free");
  let entry: TournamentDraft["entry"];
  if (entryType === "paid") {
    const amount = Number(form.get("entryAmount"));
    const currency = String(form.get("entryCurrency") ?? "USD").trim();
    if (!Number.isFinite(amount) || amount <= 0) {
      return { error: "Entry amount must be greater than zero." };
    }
    entry = { type: "paid", amount, currency };
  } else {
    entry = { type: "free" };
  }

  const host = String(form.get("host") ?? "").trim() || "Dueling Nexus";
  const signupUrl = String(form.get("signupUrl") ?? "").trim() || slugify(name);

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

function seatsLabel(seats: number | null): string {
  return seats === null ? "unlimited" : String(seats);
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
    detail: `Created tournament "${tournament.name}" (${tournament.structure}, ${seatsLabel(tournament.seats)} seats)`,
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
      ? `Updated tournament "${before.name}" -> "${updated.name}" (${before.taken}/${seatsLabel(before.seats)} -> ${updated.taken}/${seatsLabel(updated.seats)} seats)`
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
        ? `Deleted tournament "${before.name}" (had ${before.taken}/${seatsLabel(before.seats)} seats filled)`
        : `Deleted tournament "${slug}"`,
    });
  }

  revalidatePath("/admin/tournaments");
  revalidatePath("/events");
  redirect("/admin/tournaments");
}
