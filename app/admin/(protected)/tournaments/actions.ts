"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuditLogEntry, recordAction } from "@/lib/audit-log";
import { AdminActor, getAdminSession } from "@/lib/auth/session";
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
import { actionError, ActionResult, actionSuccess } from "@/lib/actions-utils";
import { tournamentErrors } from "@/lib/errors";
import { logAction } from "@/lib/backend/services/audit.service";
import { SuccessMessages } from "@/lib/success";

const STRUCTURES: readonly Structure[] = ["swiss", "single-elim", "double-elim"];
const MATCH_FORMATS = ["Bo1", "Bo3"] as const;
const MAX_BANNER_BYTES = 2 * 1024 * 1024;

async function readDraft(form: FormData): Promise<ActionResult<TournamentDraft>> {
  const name = String(form.get("name") ?? "").trim();
  if (!name) return actionError(tournamentErrors.tournament.missing.name)

  const description = String(form.get("description") ?? "").trim() || null;

  // Tri-state: a chosen file replaces it, the checkbox clears it, neither
  // leaves whatever banner is already stored untouched (see
  // TournamentsRepository.update - a plain file input can't be "prefilled"
  // with the existing upload, so silence must not mean "wipe it").
  const bannerFile = form.get("banner");
  let banner: TournamentDraft["banner"];
  if (bannerFile instanceof File && bannerFile.size > 0) {
    if (!bannerFile.type.startsWith("image/")) return actionError(tournamentErrors.tournament.invalid.bannerSize)
    if (bannerFile.size > MAX_BANNER_BYTES) return actionError(tournamentErrors.tournament.invalid.bannerType)
    banner = { data: Buffer.from(await bannerFile.arrayBuffer()), mime: bannerFile.type };
  } else if (form.get("removeBanner") === "on") {
    banner = null;
  }

  const date = String(form.get("startsAtDate") ?? "");
  const time = String(form.get("startsAtTime") ?? "");
  const timeZone = String(form.get("timezone") ?? "").trim() || "UTC";
  const startsAt = date && time ? zonedDateTimeToUtc(date, time, timeZone) : null;
  if (!startsAt) {
    return actionError(tournamentErrors.tournament.invalid.startDate)
  }

  const structure = String(form.get("structure") ?? "") as Structure;
  if (!STRUCTURES.includes(structure)) return actionError(tournamentErrors.tournament.missing.structure)

  const matchFormat = String(form.get("matchFormat") ?? "");
  if (!MATCH_FORMATS.includes(matchFormat as (typeof MATCH_FORMATS)[number])) {
    return actionError(tournamentErrors.tournament.missing.format)
  }

  const engine = String(form.get("engine") ?? "") as Engine;
  if (!(engine in ENGINES)) return actionError(tournamentErrors.tournament.missing.engine)

  // An older form post with no banlist field at all is REDU, same as every
  // tournament that existed before tournaments could be anything else.
  const banlistRaw = String(form.get("banlist") ?? DEFAULT_BANLIST);
  if (!isBanlist(banlistRaw)) return actionError(tournamentErrors.tournament.missing.banlist)

  // Rounds only means anything for Swiss - elimination brackets size
  // themselves from the field, same as startBracket() already treats it
  // (results.service.ts always passes rounds: 0 for non-Swiss structures).
  const rounds = structure === "swiss" ? Number(form.get("rounds")) : 0;
  if (structure === "swiss" && (!Number.isInteger(rounds) || rounds <= 0)) {
    return actionError(tournamentErrors.tournament.invalid.roundLength)
  }

  // Standard same-day is the default for anything that doesn't say otherwise,
  // including an older form post that has no such field at all.
  const durationMode = String(form.get("durationMode") ?? "same_day") as DurationMode;
  if (!(durationMode in DURATION_MODES)) return actionError(tournamentErrors.tournament.invalid.durationMode)

  // Each mode reads only the clock it actually uses; the other keeps its
  // default so a mode switch later finds a sane value rather than a zero.
  const roundMinutes =
    durationMode === "same_day" ? Number(form.get("roundMinutes")) : DEFAULT_ROUND_MINUTES;
  if (!Number.isInteger(roundMinutes) || roundMinutes <= 0) {
    return actionError(tournamentErrors.tournament.invalid.roundLength)
  }

  const cleanupMinutes =
    durationMode === "same_day" ? Number(form.get("cleanupMinutes")) : DEFAULT_CLEANUP_MINUTES;
  if (!Number.isInteger(cleanupMinutes) || cleanupMinutes < 0) {
    return actionError(tournamentErrors.tournament.invalid.cleanup)
  }

  const roundLimitDays = durationMode === "long" ? Number(form.get("roundLimitDays")) : 1;
  if (!Number.isInteger(roundLimitDays) || roundLimitDays <= 0) {
    return actionError(tournamentErrors.tournament.invalid.roundDeadline)
  }

  const seatsRaw = String(form.get("seats") ?? "");
  let seats: number | null;
  if (seatsRaw === "unlimited") {
    seats = null;
  } else {
    seats = Number(seatsRaw);
    if (!SEAT_OPTIONS.includes(seats as (typeof SEAT_OPTIONS)[number])) {
      return actionError(tournamentErrors.tournament.invalid.seatCount)
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
      return actionError(tournamentErrors.tournament.invalid.entry)
    }
    entry = { type: "paid", amount, currency };
  } else {
    entry = { type: "free" };
  }

  const hasPrizing = form.get("hasPrizing") === "on";

  const host = String(form.get("host") ?? "").trim() || "Dueling Nexus";
  const signupUrl = String(form.get("signupUrl") ?? "").trim() || slugify(name);
  return actionSuccess<TournamentDraft>({
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
  });
}

function seatsLabel(seats: number | null): string {
  return seats === null ? "unlimited" : String(seats);
}

/** Every action here runs behind the admin middleware, so a session always exists. */
export async function getAdminActor(): Promise<AdminActor | null> {
  try {
    const session = await getAdminSession();
    if (!session) return null

    return {
      actorId: session.userId,
      actorUsername: session.username,
      actorDisplayName: session.displayName,
    };
  }
  catch {
    return null
  }
}

export async function createTournamentAction(
  _prevState: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const draft = await readDraft(form);
  if (!draft.success) return draft;

  const tournament = await createTournament(draft.data!);

  await logAction({
    action: "tournament.create",
    target: tournament.slug,
    detail: `Created tournament "${tournament.name}" (${tournament.structure}, ${seatsLabel(tournament.seats)} seats)`,
  }, ["/admin/tournaments", "/events"]);

  return actionSuccess(undefined, SuccessMessages.tournament.created);
}

export async function updateTournamentAction(
  _prevState: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const slug = String(form.get("slug") ?? "");
  const draft = await readDraft(form);
  if (!draft.success) return draft;

  const before = await getTournament(slug);
  const updated = await updateTournament(slug, draft.data!);
  if (!updated) return actionError(tournamentErrors.tournament.failedTo.update)

  await logAction({
    action: "tournament.update",
    target: updated.slug,
    detail: before
      ? `Updated tournament "${before.name}" -> "${updated.name}" (${before.taken}/${seatsLabel(before.seats)} -> ${updated.taken}/${seatsLabel(updated.seats)} seats)`
      : `Updated tournament "${updated.name}"`,
  }, ["/admin/tournaments", `/admin/tournaments/${slug}`, `/admin/tournaments/${updated.slug}`, "/events"]);

  return actionSuccess(undefined, SuccessMessages.tournament.updated);
}

/**
 * Cancels a tournament instead of deleting it - the record, and anything
 * already played, stays visible in history; it just stops counting for
 * placings or the ranking. Valid from `scheduled` or `running` only;
 * cancelTournament() throws for anything else (already finished or
 * cancelled), which surfaces as a plain redirect back with nothing recorded.
 */
export async function cancelTournamentAction(form: FormData): Promise<ActionResult> {
  const slug = String(form.get("slug") ?? "");
  const before = await getTournament(slug);
  if (!before) return actionError(tournamentErrors.tournament.notFound);

  try {
    await cancelTournament(slug);
  } catch {
    revalidatePath(`/admin/tournaments/${slug}`);
    return actionError(tournamentErrors.tournament.failedTo.cancel)
  }

  await logAction({
    action: "tournament.cancel",
    target: slug,
    detail: `Cancelled tournament "${before.name}" (was ${before.status})`,
  }, ["/admin/tournaments", `/admin/tournaments/${slug}`, "/events"]);
  return actionSuccess(undefined, SuccessMessages.tournament.cancelled);
}

export async function deleteTournamentAction(form: FormData): Promise<ActionResult> {
  const slug = String(form.get("slug") ?? "");
  const before = await getTournament(slug);
  if (!before) return actionError(tournamentErrors.tournament.notFound);

  const deleted = await deleteTournament(slug);
  if (!deleted) return actionError(tournamentErrors.tournament.failedTo.delete);

  await logAction({
    action: "tournament.delete",
    target: slug,
    detail: before
      ? `Deleted tournament "${before.name}" (had ${before.taken}/${seatsLabel(before.seats)} seats filled)`
      : `Deleted tournament "${slug}"`,
  }, ["/admin/tournaments", "/events"]);

  return actionSuccess(undefined, SuccessMessages.tournament.deleted);
}

/**
 * Saves a batch of redemption codes. The form posts one `code` and one `tier`
 * per row, so the two arrays are paired back up by position. Blank rows are
 * dropped rather than rejected - an empty extra row is how the form looks
 * right after someone clicks "+". The service refuses once the tournament is
 * finished.
 */
export async function addPrizesAction(form: FormData): Promise<ActionResult> {
  const slug = String(form.get("slug") ?? "");
  const codes = form.getAll("code").map((v) => String(v).trim());
  const tiers = form.getAll("tier").map((v) => String(v));

  const entries = codes
    .map((code, i) => ({ code, tier: tiers[i] ?? "" }))
    .filter((entry) => entry.code !== "");

  if (entries.length === 0) {
    return actionError(tournamentErrors.tournament.missing.code);
  }
  if (!entries.every((entry) => isPrizeTier(entry.tier))) {
    return actionError(tournamentErrors.tournament.missing.prizeType);
  }

  try {
    await addPrizes(slug, entries as { tier: PrizeTier; code: string }[]);
  } catch (error) {
    return actionError(tournamentErrors.tournament.prizing.failedTo.add);
  }

  return actionSuccess(undefined, SuccessMessages.prizing.added);
}

export async function removePrizeAction(form: FormData): Promise<ActionResult> {
  const slug = String(form.get("slug") ?? "");
  const prizeId = String(form.get("prizeId") ?? "");

  try {
    await removePrize(slug, prizeId)
  
    await logAction({
      action: "prize.remove",
      target: slug,
      detail: "Removed a prize code",
    }, [`/admin/tournaments/${slug}`]);
  } catch (error) {
    return actionError(tournamentErrors.tournament.prizing.failedTo.remove);
  }

  return actionSuccess(undefined, SuccessMessages.prizing.removed);
}

/** The one-shot mailing, once the tournament is over. See sendPrizes(). */
export async function sendPrizesAction(form: FormData): Promise<ActionResult> {
  const slug = String(form.get("slug") ?? "");

  let result;
  try {
    result = await sendPrizes(slug);
  } catch (error) {
    return actionError(tournamentErrors.tournament.prizing.failedTo.send)
  }

  await logAction({
    action: "prize.send",
    target: slug,
    detail: `Sent ${result.sent} prize code(s), ${result.unclaimed} left unclaimed`,
  }, [`/admin/tournaments/${slug}`]);

  return actionSuccess(undefined, SuccessMessages.prizing.sent);
}

