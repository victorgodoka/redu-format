"use server";

import { revalidatePath } from "next/cache";
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
  linkParticipant,
  listParticipants,
  removeParticipant,
  setParticipantDeck,
  setParticipantPayment,
} from "@/lib/tournaments";
import { tournamentErrors } from "@/lib/errors";
import { actionError, ActionResult, actionSuccess } from "@/lib/actions-utils";
import { logAction } from "@/lib/backend/services/audit.service";
import { SuccessMessages } from "@/lib/success";

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

/**
 * Adds a registration by hand. When the name matches a registered duelist -
 * which is what the form's autocomplete is for - the registration is linked to
 * that account, exactly as their own signup would have been: same identity
 * snapshot, same deck id, so the deck lock, the inbox, prize codes and the
 * leaderboard all treat them as the player they are. A name nobody here owns
 * still goes in as a plain entry, which is all it can be.
 */
export async function addParticipantAction(
  _prevState: ActionResult,
  form: FormData
): Promise<ActionResult> {
  const slug = String(form.get("slug") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const deckUuid = String(form.get("deckName") ?? "").trim();

  if (!slug || !name || !deckUuid) return actionError(tournamentErrors.participant.add.missingRequiredFields);

  const check = await verifyDeckUuid(deckUuid);
  if (!check.ok) return actionError(check.error);

  const player = await findPlayerByName(name);
  if (!player) return actionError(tournamentErrors.participant.add.playerNotFound(name));
  try {
    await addParticipant(slug, {
      name: player?.nexusName ?? name,
      player: { id: player.id, identityKey: player.nexusIdentityKey, deckId: deckUuid }
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Duplicate")) {
      return actionError(tournamentErrors.participant.add.alreadyRegistered(player?.nexusName ?? name));
    }
    return actionError(err instanceof Error ? err.message : tournamentErrors.participant.add.addFailed);
  }

  await recordAction({
    ...(await actor()),
    action: "participant.add",
    target: slug,
    detail: player
      ? `Added registered duelist "${player.nexusName}" to "${slug}" with deck ${deckUuid}`
      : `Added participant "${name}" (no linked account) to "${slug}" with deck ${deckUuid}`,
  });

  revalidatePath(
    `/admin/tournaments/${slug}/participants`
  );

  return actionSuccess(undefined, SuccessMessages.participant.added);
}

/**
 * Links an already-added, unlinked participant to a real account after the
 * fact - for when the name typed in at add-time didn't match (a typo, a name
 * that has since changed), which otherwise leaves them permanently unable to
 * see their own lobby or receive prize codes and ranking points. Reuses
 * addParticipantAction's exact-match-by-name lookup; the deck the account
 * plays stays whatever was already registered.
 */
export async function linkParticipantAction(form: FormData): Promise<ActionResult> {
  const slug = String(form.get("slug") ?? "");
  const participantId = String(form.get("participantId") ?? "");
  const name = String(form.get("name") ?? "").trim();
  if (!slug || !participantId || !name) return actionError(tournamentErrors.participant.link.missingRequiredFields);

  const before = (await listParticipants(slug)).find((p) => p.id === participantId);
  if (!before) return actionError(tournamentErrors.participant.link.participantNotFound);
  if (before.playerId) return actionError(tournamentErrors.participant.link.alreadyLinked(before.name, before.playerId));

  const player = await findPlayerByName(name);
  if (!player) return actionError(tournamentErrors.participant.link.playerNotFound(name));

  const linked = await linkParticipant(participantId, {
    id: player.id,
    identityKey: player.nexusIdentityKey,
    deckName: before.deckName,
    deckId: before.deckUUID ?? "",
  });

  if (!linked) return actionError(tournamentErrors.participant.link.linkFailed);

  await recordAction({
    ...(await actor()),
    action: "participant.link",
    target: slug,
    detail: `Linked "${before.name}" in "${slug}" to the account "${player.nexusName}"`,
  });

  revalidatePath(`/admin/tournaments/${slug}/participants`);
  return actionSuccess(undefined, SuccessMessages.participant.linked);
}

/** Deck can only change before the bracket starts - past that, results already depend on who's holding what. */
export async function editParticipantDeckAction(form: FormData): Promise<ActionResult> {
  const slug = String(form.get("slug") ?? "");
  const participantId = String(form.get("participantId") ?? "");
  const deckUuid = String(form.get("deckName") ?? "").trim();
  if (!slug || !participantId || !deckUuid) return actionError(tournamentErrors.participant.deck.missingRequiredFields);

  if (await hasBracket(slug)) {
    return actionError(tournamentErrors.participant.deck.tournamentStarted);
  }

  const check = await verifyDeckUuid(deckUuid);
  if (!check.ok) return actionError(check.error);

  const before = (await listParticipants(slug)).find((p) => p.id === participantId);
  const updated = await setParticipantDeck(slug, participantId, deckUuid);
  if (!updated) return actionError(tournamentErrors.participant.deck.participantNotFound);

  await recordAction({
    ...(await actor()),
    action: "participant.deck_update",
    target: slug,
    detail: before
      ? `Changed the deck for "${before.name}" in "${slug}" from ${before.deckName} to ${deckUuid}`
      : `Changed a participant's deck in "${slug}" to ${deckUuid}`,
  });

  revalidatePath(`/admin/tournaments/${slug}/participants`);
  return actionSuccess(undefined, SuccessMessages.participant.deckUpdated);
}

/**
 * Exceptional post-start deck correction - e.g. a registration was made with
 * the wrong deck by mistake. Unlike editParticipantDeckAction, this is
 * reachable after the bracket has started; it exists specifically for that
 * case, logged under its own audit action so it's never confused with a
 * routine pre-start edit.
 */
export async function overrideParticipantDeckAction(form: FormData): Promise<ActionResult> {
  const slug = String(form.get("slug") ?? "");
  const participantId = String(form.get("participantId") ?? "");
  const deckUuid = String(form.get("deckName") ?? "").trim();
  if (!slug || !participantId || !deckUuid) return actionError(tournamentErrors.participant.deck.missingRequiredFields);

  const check = await verifyDeckUuid(deckUuid);
  if (!check.ok) return actionError(check.error);

  const before = (await listParticipants(slug)).find((p) => p.id === participantId);
  const updated = await setParticipantDeck(slug, participantId, deckUuid);
  if (!updated) return actionError(tournamentErrors.participant.deck.participantNotFound);

  await recordAction({
    ...(await actor()),
    action: "participant.deck_override",
    target: slug,
    detail: before
      ? `OVERRIDE: changed the deck for "${before.name}" in "${slug}" from ${before.deckName} to ${deckUuid} after the tournament had already started`
      : `OVERRIDE: changed a participant's deck in "${slug}" to ${deckUuid} after the tournament had already started`,
  });

  revalidatePath(`/admin/tournaments/${slug}/participants`);
  return actionSuccess(undefined, SuccessMessages.participant.deckUpdated);
}

/**
 * Confirms a paid entry. A new proof URL replaces the stored one; leaving it
 * blank re-approves the existing proof as-is (the "confirm the old one"
 * path out of a contested state). Requires a proof from one source or the
 * other - there is nothing to confirm otherwise.
 */
export async function confirmPaymentAction(form: FormData): Promise<ActionResult> {
  const slug = String(form.get("slug") ?? "");
  const participantId = String(form.get("participantId") ?? "");
  const newProofUrl = String(form.get("proofUrl") ?? "").trim();
  if (!slug || !participantId) return actionError(tournamentErrors.participant.payment.missingParticipant);
  if (newProofUrl && !isHttpUrl(newProofUrl)) return actionError(tournamentErrors.participant.payment.invalidProofUrl);

  const before = (await listParticipants(slug)).find((p) => p.id === participantId);
  if (!before) return actionError(tournamentErrors.participant.payment.missingParticipant);

  const proofUrl = newProofUrl || before.proofUrl;
  if (!proofUrl) return actionError(tournamentErrors.participant.payment.missingProof);

  const who = await actor();
  const updated = await setParticipantPayment(slug, participantId, {
    status: "confirmed",
    proofUrl,
    by: who.actorDisplayName,
  });
  if (!updated) return actionError(tournamentErrors.participant.payment.confirmFailed);

  await recordAction({
    ...who,
    action: "payment.confirm",
    target: slug,
    detail: newProofUrl
      ? `Confirmed payment for "${before.name}" in "${slug}" with a new proof: ${proofUrl}`
      : `Re-confirmed payment for "${before.name}" in "${slug}" using the existing proof: ${proofUrl}`,
  });

  revalidatePath(`/admin/tournaments/${slug}/participants`);
  return actionSuccess(undefined, SuccessMessages.participant.paymentConfirmed);
}

/** Disputes a confirmed entry; it goes back to waiting until re-approved. */
export async function contestPaymentAction(
  _prevState: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const slug = String(form.get("slug") ?? "");
  const participantId = String(form.get("participantId") ?? "");
  if (!slug || !participantId) return actionError(tournamentErrors.participant.payment.confirmFailed);

  const before = (await listParticipants(slug)).find((p) => p.id === participantId);
  if (!before) return actionError(tournamentErrors.participant.payment.missingParticipant);
  if (before.paymentStatus !== "confirmed") return actionError(tournamentErrors.participant.payment.invalidPaymentState);

  const who = await actor();
  const updated = await setParticipantPayment(slug, participantId, {
    status: "contested",
    proofUrl: before.proofUrl,
    by: who.actorDisplayName,
  });
  if (!updated) return actionError(tournamentErrors.participant.payment.contestFailed);

  await recordAction({
    ...who,
    action: "payment.contest",
    target: slug,
    detail: `Contested the payment confirmation for "${before.name}" in "${slug}"`,
  });

  revalidatePath(`/admin/tournaments/${slug}/participants`);
  return actionSuccess(undefined, SuccessMessages.participant.paymentContested);
}

/**
 * Before the bracket starts, this is a real delete. Once it's started, the
 * same button means drop instead - the registration stays (results,
 * tiebreakers) but the player is deactivated for the rest of the event, same
 * as results.service's dropFromStartedTournament used by the public
 * self-drop flow.
 */
export async function removeParticipantAction(form: FormData): Promise<ActionResult> {
  const slug = String(form.get("slug") ?? "");
  const participantId = String(form.get("participantId") ?? "");
  if (!slug || !participantId) return actionError(tournamentErrors.participant.remove.missingParticipant);

  const before = (await listParticipants(slug)).find((p) => p.id === participantId);
  if (!before) return actionError(tournamentErrors.participant.remove.participantNotFound);

  if (await hasBracket(slug)) {
    await dropFromStartedTournament(slug, participantId);
    await logAction({
      action: "participant.drop",
      target: slug,
      detail: `Dropped "${before.name}" from "${slug}" (tournament already in progress)`,
    }, [`/admin/tournaments/${slug}/participants`, `/admin/tournaments/${slug}/bracket`]);
    
    return actionSuccess(undefined, SuccessMessages.drop(before.name));
  }

  const removed = await removeParticipant(slug, participantId);
  if (removed) {
    await logAction({
      action: "participant.remove",
      target: slug,
      detail: `Removed participant "${before.name}" from "${slug}"`,
    }, [`/admin/tournaments/${slug}/participants`]);
  }

  return actionSuccess(undefined, SuccessMessages.drop(before.name));
}

/**
 * A moderator disqualifying someone by hand - the same machinery the deck
 * lock and the two-no-show rule use: recorded on the registration with a
 * reason, out of the bracket, and the player is told why. Reversible via
 * reinstateParticipantAction.
 */
export async function disqualifyParticipantAction(form: FormData): Promise<ActionResult> {
  const slug = String(form.get("slug") ?? "");
  const participantId = String(form.get("participantId") ?? "");
  const reason = String(form.get("reason") ?? "").trim();
  const actorDisplayName = String(form.get("actorDisplayName") ?? "").trim();
  if (!slug || !participantId) return actionError(tournamentErrors.participant.disqualify.missingParticipant);
  if (!reason) return actionError(tournamentErrors.participant.disqualify.missingReason);

  const before = (await listParticipants(slug)).find((p) => p.id === participantId);
  if (!before) return actionError(tournamentErrors.participant.disqualify.participantNotFound);

  await disqualifyRegistration(slug, participantId, reason, actorDisplayName);

  await logAction({
    action: "participant.disqualify",
    target: slug,
    detail: `Disqualified "${before.name}" from "${slug}": ${reason}`,
  }, [`/admin/tournaments/${slug}/participants`, `/admin/tournaments/${slug}/bracket`, `/events/${slug}`]);

  return actionSuccess(undefined, SuccessMessages.dqed(before.name));
}

/** Undoes a disqualification or a drop. Matches conceded while they were out stay as they are - correct those individually. */
export async function reinstateParticipantAction(
  _prevState: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const slug = String(form.get("slug") ?? "");
  const participantId = String(form.get("participantId") ?? "");
  if (!slug || !participantId) return actionError(tournamentErrors.participant.reinstate.missingParticipant);

  const before = (await listParticipants(slug)).find((p) => p.id === participantId);
  if (!before) return actionError(tournamentErrors.participant.reinstate.participantNotFound);

  const who = await actor();
  await reinstateRegistration(slug, participantId);

  await recordAction({
    ...who,
    action: "participant.reinstate",
    target: slug,
    detail: `Reinstated "${before.name}" in "${slug}" (was: ${before.dqReason ?? (before.droppedAt ? "dropped" : "disqualified")})`,
  });

  revalidatePath(`/admin/tournaments/${slug}/participants`);
  revalidatePath(`/admin/tournaments/${slug}/bracket`);
  revalidatePath(`/events/${slug}`);
  return actionSuccess(undefined, SuccessMessages.participant.reinstated);
}
