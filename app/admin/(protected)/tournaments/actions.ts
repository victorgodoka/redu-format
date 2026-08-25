"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAction } from "@/lib/audit-log";
import { getAdminSession } from "@/lib/auth/session";
import {
  DEFAULT_BANLIST,
  DEFAULT_CLEANUP_MINUTES,
  DEFAULT_ROUND_MINUTES,
  DURATION_MODES,
  ENGINES,
  isBanlist,
  recommendedTopCut,
  SEAT_OPTIONS,
  zonedDateTimeToUtc,
  type DurationMode,
  type Engine,
  type Structure,
} from "@/lib/events";
import { isPrizeTier, type PrizeTier } from "@/lib/prizing";
import { addPrizes, removePrize, sendPrizes } from "@/lib/backend/services/prizing.service";
import {
  cancelTournament,
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
const MAX_BANNER_BYTES = 5 * 1024 * 1024;

async function readDraft(form: FormData): Promise<TournamentDraft | { error: string }> {
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };

  const description = String(form.get("description") ?? "").trim() || null;

  // Tri-state: a chosen file replaces it, the checkbox clears it, neither
  // leaves whatever banner is already stored untouched (see
  // TournamentsRepository.update - a plain file input can't be "prefilled"
  // with the existing upload, so silence must not mean "wipe it").
  const bannerFile = form.get("banner");
  let banner: TournamentDraft["banner"];
  if (bannerFile instanceof File && bannerFile.size > 0) {
    if (!bannerFile.type.startsWith("image/")) return { error: "Banner must be an image file." };
    if (bannerFile.size > MAX_BANNER_BYTES) return { error: "Banner image must be under 5MB." };
    banner = { data: Buffer.from(await bannerFile.arrayBuffer()), mime: bannerFile.type };
  } else if (form.get("removeBanner") === "on") {
    banner = null;
  }

  const date = String(form.get("startsAtDate") ?? "");
  const time = String(form.get("startsAtTime") ?? "");
  const timeZone = String(form.get("timezone") ?? "").trim() || "UTC";
  const startsAt = date && time ? zonedDateTimeToUtc(date, time, timeZone) : null;
  if (!startsAt) {
    return { error: "Pick a valid start date, time, and timezone." };
  }

  const structure = String(form.get("structure") ?? "") as Structure;
  if (!STRUCTURES.includes(structure)) return { error: "Pick a structure." };

  const matchFormat = String(form.get("matchFormat") ?? "");
  if (!MATCH_FORMATS.includes(matchFormat as (typeof MATCH_FORMATS)[number])) {
    return { error: "Pick a match format." };
  }

  const engine = String(form.get("engine") ?? "") as Engine;
  if (!(engine in ENGINES)) return { error: "Pick an engine." };

  // An older form post with no banlist field at all is REDU, same as every
  // tournament that existed before tournaments could be anything else.
  const banlistRaw = String(form.get("banlist") ?? DEFAULT_BANLIST);
  if (!isBanlist(banlistRaw)) return { error: "Pick a banlist." };

  // Rounds only means anything for Swiss - elimination brackets size
  // themselves from the field, same as startBracket() already treats it
  // (results.service.ts always passes rounds: 0 for non-Swiss structures).
  const rounds = structure === "swiss" ? Number(form.get("rounds")) : 0;
  if (structure === "swiss" && (!Number.isInteger(rounds) || rounds <= 0)) {
    return { error: "Rounds must be a positive whole number." };
  }

  // Standard same-day is the default for anything that doesn't say otherwise,
  // including an older form post that has no such field at all.
  const durationMode = String(form.get("durationMode") ?? "same_day") as DurationMode;
  if (!(durationMode in DURATION_MODES)) return { error: "Pick a tournament duration mode." };

  // Each mode reads only the clock it actually uses; the other keeps its
  // default so a mode switch later finds a sane value rather than a zero.
  const roundMinutes =
    durationMode === "same_day" ? Number(form.get("roundMinutes")) : DEFAULT_ROUND_MINUTES;
  if (!Number.isInteger(roundMinutes) || roundMinutes <= 0) {
    return { error: "Round length must be a positive whole number of minutes." };
  }

  const cleanupMinutes =
    durationMode === "same_day" ? Number(form.get("cleanupMinutes")) : DEFAULT_CLEANUP_MINUTES;
  if (!Number.isInteger(cleanupMinutes) || cleanupMinutes < 0) {
    return { error: "Cleanup period must be a whole number of minutes." };
  }

  const roundLimitDays = durationMode === "long" ? Number(form.get("roundLimitDays")) : 1;
  if (!Number.isInteger(roundLimitDays) || roundLimitDays <= 0) {
    return { error: "Round deadline must be a positive whole number of days." };
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

  const hasPrizing = form.get("hasPrizing") === "on";

  const host = String(form.get("host") ?? "").trim() || "Dueling Nexus";
  const signupUrl = String(form.get("signupUrl") ?? "").trim() || slugify(name);

  return {
    name,
    description,
    banner,
    startsAt: startsAt.toISOString(),
    structure,
    rounds,
    topCut,
    matchFormat: matchFormat as (typeof MATCH_FORMATS)[number],
    roundLimitDays,
    durationMode,
    roundMinutes,
    cleanupMinutes,
    engine,
    banlist: banlistRaw,
    seats,
    entry,
    host,
    signupUrl,
    hasPrizing,
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
  const draft = await readDraft(form);
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
  const draft = await readDraft(form);
  if ("error" in draft) return draft;

  const before = await getTournament(slug);
  const updated = await updateTournament(slug, draft);
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

/**
 * Cancels a tournament instead of deleting it - the record, and anything
 * already played, stays visible in history; it just stops counting for
 * placings or the ranking. Valid from `scheduled` or `running` only;
 * cancelTournament() throws for anything else (already finished or
 * cancelled), which surfaces as a plain redirect back with nothing recorded.
 */
export async function cancelTournamentAction(form: FormData) {
  const slug = String(form.get("slug") ?? "");
  const before = await getTournament(slug);
  if (!before) redirect("/admin/tournaments");

  try {
    await cancelTournament(slug);
  } catch {
    revalidatePath(`/admin/tournaments/${slug}`);
    redirect(`/admin/tournaments/${slug}`);
  }

  await recordAction({
    ...(await actor()),
    action: "tournament.cancel",
    target: slug,
    detail: `Cancelled tournament "${before.name}" (was ${before.status})`,
  });

  revalidatePath("/admin/tournaments");
  revalidatePath(`/admin/tournaments/${slug}`);
  revalidatePath("/events");
  redirect(`/admin/tournaments/${slug}`);
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

/**
 * Saves a batch of redemption codes. The form posts one `code` and one `tier`
 * per row, so the two arrays are paired back up by position. Blank rows are
 * dropped rather than rejected - an empty extra row is how the form looks
 * right after someone clicks "+". The service refuses once the tournament is
 * finished.
 */
export async function addPrizesAction(form: FormData) {
  const slug = String(form.get("slug") ?? "");
  const codes = form.getAll("code").map((v) => String(v).trim());
  const tiers = form.getAll("tier").map((v) => String(v));

  const entries = codes
    .map((code, i) => ({ code, tier: tiers[i] ?? "" }))
    .filter((entry) => entry.code !== "");

  if (entries.length === 0) {
    redirect(`/admin/tournaments/${slug}?error=${encodeURIComponent("Enter at least one code.")}`);
  }
  if (!entries.every((entry) => isPrizeTier(entry.tier))) {
    redirect(`/admin/tournaments/${slug}?error=${encodeURIComponent("Pick a prize type for every code.")}`);
  }

  try {
    await addPrizes(slug, entries as { tier: PrizeTier; code: string }[]);
  } catch (error) {
    redirect(`/admin/tournaments/${slug}?error=${encodeURIComponent(message(error))}`);
  }

  await recordAction({
    ...(await actor()),
    action: "prize.add",
    target: slug,
    detail: `Added ${entries.length} prize code(s): ${entries.map((e) => e.tier).join(", ")}`,
  });

  revalidatePath(`/admin/tournaments/${slug}`);
  redirect(`/admin/tournaments/${slug}`);
}

export async function removePrizeAction(form: FormData) {
  const slug = String(form.get("slug") ?? "");
  const prizeId = String(form.get("prizeId") ?? "");

  if (await removePrize(slug, prizeId)) {
    await recordAction({
      ...(await actor()),
      action: "prize.remove",
      target: slug,
      detail: "Removed a prize code",
    });
  }

  revalidatePath(`/admin/tournaments/${slug}`);
  redirect(`/admin/tournaments/${slug}`);
}

/** The one-shot mailing, once the tournament is over. See sendPrizes(). */
export async function sendPrizesAction(form: FormData) {
  const slug = String(form.get("slug") ?? "");

  let result;
  try {
    result = await sendPrizes(slug);
  } catch (error) {
    redirect(`/admin/tournaments/${slug}?error=${encodeURIComponent(message(error))}`);
  }

  await recordAction({
    ...(await actor()),
    action: "prize.send",
    target: slug,
    detail: `Sent ${result.sent} prize code(s), ${result.unclaimed} left unclaimed`,
  });

  revalidatePath(`/admin/tournaments/${slug}`);
  redirect(
    `/admin/tournaments/${slug}?sent=${result.sent}&unclaimed=${result.unclaimed}`,
  );
}

/** The service's own message when it refuses (closed prizing, already sent), or a generic one. */
function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}
