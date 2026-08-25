"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAction } from "@/lib/audit-log";
import {
  disqualifyRegistration,
  dropFromStartedTournament,
  hasBracket,
  reinstateRegistration,
} from "@/lib/backend/services/results.service";
import { getAdminSession } from "@/lib/auth/session";
import { findPlayerByName } from "@/lib/backend/services/player.service";
import { NEXUS_DECK_INFO_URL } from "@/lib/nexus-parse";
import { isHttpUrl } from "@/lib/safe-url";
import {
  addParticipant,
  listParticipants,
  removeParticipant,
  setParticipantDeck,
  setParticipantPayment,
} from "@/lib/tournaments";

/**
 * Confirms a Dueling Nexus deck UUID is real and public before it's stored -
 * Nexus answers HTTP 200 with `success: false` for a bad or private uuid, so
 * only the body decides.
 */
async function verifyDeckUuid(uuid: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!uuid) return { ok: false, error: "Enter a Dueling Nexus deck UUID." };

  let payload: unknown;
  try {
    const res = await fetch(`${NEXUS_DECK_INFO_URL}?uuid=${encodeURIComponent(uuid)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    payload = await res.json();
  } catch {
    return { ok: false, error: "Couldn't reach Dueling Nexus to check that deck. Try again." };
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    (payload as { success?: unknown }).success !== true
  ) {
    return { ok: false, error: "That deck doesn't exist or isn't public on Dueling Nexus." };
  }
  return { ok: true };
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

function errorRedirect(slug: string, message: string): never {
  redirect(`/admin/tournaments/${slug}/participants?error=${encodeURIComponent(message)}`);
}

/**
 * Adds a registration by hand. When the name matches a registered duelist -
 * which is what the form's autocomplete is for - the registration is linked to
 * that account, exactly as their own signup would have been: same identity
 * snapshot, same deck id, so the deck lock, the inbox, prize codes and the
 * leaderboard all treat them as the player they are. A name nobody here owns
 * still goes in as a plain entry, which is all it can be.
 */
export async function addParticipantAction(form: FormData) {
  const slug = String(form.get("slug") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const deckUuid = String(form.get("deckName") ?? "").trim();
  if (!slug || !name || !deckUuid) return;

  const check = await verifyDeckUuid(deckUuid);
  if (!check.ok) errorRedirect(slug, check.error);

  const player = await findPlayerByName(name);

  try {
    await addParticipant(slug, {
      // The account's own Nexus name, not whatever casing was typed.
      name: player?.nexusName ?? name,
      deckName: deckUuid,
      player: player
        ? { id: player.id, identityKey: player.nexusIdentityKey, deckId: deckUuid }
        : undefined,
    });
  } catch (err) {
    // uq_registrations_tournament_player: the same account cannot hold two
    // registrations in one tournament. Saying so beats a 500.
    if (err instanceof Error && err.message.includes("Duplicate")) {
      errorRedirect(slug, `${player?.nexusName ?? name} is already registered for this tournament.`);
    }
    errorRedirect(slug, err instanceof Error ? err.message : "Could not add that participant.");
  }

  await recordAction({
    ...(await actor()),
    action: "participant.add",
    target: slug,
    detail: player
      ? `Added registered duelist "${player.nexusName}" to "${slug}" with deck ${deckUuid}`
      : `Added participant "${name}" (no linked account) to "${slug}" with deck ${deckUuid}`,
  });

  revalidatePath(`/admin/tournaments/${slug}/participants`);
  redirect(`/admin/tournaments/${slug}/participants`);
}

/** Deck can only change before the bracket starts - past that, results already depend on who's holding what. */
export async function editParticipantDeckAction(form: FormData) {
  const slug = String(form.get("slug") ?? "");
  const participantId = String(form.get("participantId") ?? "");
  const deckUuid = String(form.get("deckName") ?? "").trim();
  if (!slug || !participantId || !deckUuid) return;

  if (await hasBracket(slug)) {
    errorRedirect(slug, "This tournament has already started - the deck can't be changed anymore.");
  }

  const check = await verifyDeckUuid(deckUuid);
  if (!check.ok) errorRedirect(slug, check.error);

  const before = (await listParticipants(slug)).find((p) => p.id === participantId);
  const updated = await setParticipantDeck(slug, participantId, deckUuid);
  if (!updated) errorRedirect(slug, "That participant no longer exists.");

  await recordAction({
    ...(await actor()),
    action: "participant.deck_update",
    target: slug,
    detail: before
      ? `Changed the deck for "${before.name}" in "${slug}" from ${before.deckName} to ${deckUuid}`
      : `Changed a participant's deck in "${slug}" to ${deckUuid}`,
  });

  revalidatePath(`/admin/tournaments/${slug}/participants`);
  redirect(`/admin/tournaments/${slug}/participants`);
}

/**
 * Exceptional post-start deck correction - e.g. a registration was made with
 * the wrong deck by mistake. Unlike editParticipantDeckAction, this is
 * reachable after the bracket has started; it exists specifically for that
 * case, logged under its own audit action so it's never confused with a
 * routine pre-start edit.
 */
export async function overrideParticipantDeckAction(form: FormData) {
  const slug = String(form.get("slug") ?? "");
  const participantId = String(form.get("participantId") ?? "");
  const deckUuid = String(form.get("deckName") ?? "").trim();
  if (!slug || !participantId || !deckUuid) return;

  const check = await verifyDeckUuid(deckUuid);
  if (!check.ok) errorRedirect(slug, check.error);

  const before = (await listParticipants(slug)).find((p) => p.id === participantId);
  const updated = await setParticipantDeck(slug, participantId, deckUuid);
  if (!updated) errorRedirect(slug, "That participant no longer exists.");

  await recordAction({
    ...(await actor()),
    action: "participant.deck_override",
    target: slug,
    detail: before
      ? `OVERRIDE: changed the deck for "${before.name}" in "${slug}" from ${before.deckName} to ${deckUuid} after the tournament had already started`
      : `OVERRIDE: changed a participant's deck in "${slug}" to ${deckUuid} after the tournament had already started`,
  });

  revalidatePath(`/admin/tournaments/${slug}/participants`);
  redirect(`/admin/tournaments/${slug}/participants`);
}

/**
 * Confirms a paid entry. A new proof URL replaces the stored one; leaving it
 * blank re-approves the existing proof as-is (the "confirm the old one"
 * path out of a contested state). Requires a proof from one source or the
 * other - there is nothing to confirm otherwise.
 */
export async function confirmPaymentAction(form: FormData) {
  const slug = String(form.get("slug") ?? "");
  const participantId = String(form.get("participantId") ?? "");
  const newProofUrl = String(form.get("proofUrl") ?? "").trim();
  if (!slug || !participantId) return;
  if (newProofUrl && !isHttpUrl(newProofUrl)) return;

  const before = (await listParticipants(slug)).find((p) => p.id === participantId);
  if (!before) return;

  const proofUrl = newProofUrl || before.proofUrl;
  if (!proofUrl) return;

  const who = await actor();
  const updated = await setParticipantPayment(slug, participantId, {
    status: "confirmed",
    proofUrl,
    by: who.actorDisplayName,
  });
  if (!updated) return;

  await recordAction({
    ...who,
    action: "payment.confirm",
    target: slug,
    detail: newProofUrl
      ? `Confirmed payment for "${before.name}" in "${slug}" with a new proof: ${proofUrl}`
      : `Re-confirmed payment for "${before.name}" in "${slug}" using the existing proof: ${proofUrl}`,
  });

  revalidatePath(`/admin/tournaments/${slug}/participants`);
}

/** Disputes a confirmed entry; it goes back to waiting until re-approved. */
export async function contestPaymentAction(form: FormData) {
  const slug = String(form.get("slug") ?? "");
  const participantId = String(form.get("participantId") ?? "");
  if (!slug || !participantId) return;

  const before = (await listParticipants(slug)).find((p) => p.id === participantId);
  if (!before || before.paymentStatus !== "confirmed") return;

  const who = await actor();
  const updated = await setParticipantPayment(slug, participantId, {
    status: "contested",
    proofUrl: before.proofUrl,
    by: who.actorDisplayName,
  });
  if (!updated) return;

  await recordAction({
    ...who,
    action: "payment.contest",
    target: slug,
    detail: `Contested the payment confirmation for "${before.name}" in "${slug}"`,
  });

  revalidatePath(`/admin/tournaments/${slug}/participants`);
}

/**
 * Before the bracket starts, this is a real delete. Once it's started, the
 * same button means drop instead - the registration stays (results,
 * tiebreakers) but the player is deactivated for the rest of the event, same
 * as results.service's dropFromStartedTournament used by the public
 * self-drop flow.
 */
export async function removeParticipantAction(form: FormData) {
  const slug = String(form.get("slug") ?? "");
  const participantId = String(form.get("participantId") ?? "");
  if (!slug || !participantId) return;

  const before = (await listParticipants(slug)).find((p) => p.id === participantId);
  if (!before) return;

  if (await hasBracket(slug)) {
    await dropFromStartedTournament(slug, participantId);
    await recordAction({
      ...(await actor()),
      action: "participant.drop",
      target: slug,
      detail: `Dropped "${before.name}" from "${slug}" (tournament already in progress)`,
    });
    revalidatePath(`/admin/tournaments/${slug}/participants`);
    revalidatePath(`/admin/tournaments/${slug}/bracket`);
    return;
  }

  const removed = await removeParticipant(slug, participantId);
  if (removed) {
    await recordAction({
      ...(await actor()),
      action: "participant.remove",
      target: slug,
      detail: `Removed participant "${before.name}" from "${slug}"`,
    });
  }

  revalidatePath(`/admin/tournaments/${slug}/participants`);
}

/**
 * A moderator disqualifying someone by hand - the same machinery the deck
 * lock and the two-no-show rule use: recorded on the registration with a
 * reason, out of the bracket, and the player is told why. Reversible via
 * reinstateParticipantAction.
 */
export async function disqualifyParticipantAction(form: FormData) {
  const slug = String(form.get("slug") ?? "");
  const participantId = String(form.get("participantId") ?? "");
  const reason = String(form.get("reason") ?? "").trim();
  if (!slug || !participantId) return;
  if (!reason) errorRedirect(slug, "A disqualification needs a reason - the player is told what it says.");

  const before = (await listParticipants(slug)).find((p) => p.id === participantId);
  if (!before) return;

  const who = await actor();
  await disqualifyRegistration(slug, participantId, reason, who.actorDisplayName);

  await recordAction({
    ...who,
    action: "participant.disqualify",
    target: slug,
    detail: `Disqualified "${before.name}" from "${slug}": ${reason}`,
  });

  revalidatePath(`/admin/tournaments/${slug}/participants`);
  revalidatePath(`/admin/tournaments/${slug}/bracket`);
  revalidatePath(`/events/${slug}`);
}

/** Undoes a disqualification. Matches conceded while they were out stay as they are - correct those individually. */
export async function reinstateParticipantAction(form: FormData) {
  const slug = String(form.get("slug") ?? "");
  const participantId = String(form.get("participantId") ?? "");
  if (!slug || !participantId) return;

  const before = (await listParticipants(slug)).find((p) => p.id === participantId);
  if (!before) return;

  const who = await actor();
  await reinstateRegistration(slug, participantId);

  await recordAction({
    ...who,
    action: "participant.reinstate",
    target: slug,
    detail: `Reinstated "${before.name}" in "${slug}" (was: ${before.dqReason ?? "disqualified"})`,
  });

  revalidatePath(`/admin/tournaments/${slug}/participants`);
  revalidatePath(`/admin/tournaments/${slug}/bracket`);
  revalidatePath(`/events/${slug}`);
}
