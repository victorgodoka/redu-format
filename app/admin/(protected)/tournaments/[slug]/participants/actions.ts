"use server";

import { revalidatePath } from "next/cache";
import { recordAction } from "@/lib/audit-log";
import { getAdminSession } from "@/lib/auth/session";
import {
  addParticipant,
  listParticipants,
  removeParticipant,
  setParticipantPayment,
} from "@/lib/tournaments";

/** Payment proof is rendered as a clickable link, so only http(s) is trusted. */
function isSafeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
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

export async function addParticipantAction(form: FormData) {
  const slug = String(form.get("slug") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const deckName = String(form.get("deckName") ?? "").trim();
  if (!slug || !name || !deckName) return;

  await addParticipant(slug, { name, deckName });
  await recordAction({
    ...(await actor()),
    action: "participant.add",
    target: slug,
    detail: `Added participant "${name}" to "${slug}" with deck "${deckName}"`,
  });

  revalidatePath(`/admin/tournaments/${slug}/participants`);
}

/**
 * Confirms a paid entry. A new proof URL replaces the stored one; leaving it
 * blank re-approves the existing proof as-is (the "confirm the old one"
 * path out of a contested state). Requires a proof from one source or the
 * other — there is nothing to confirm otherwise.
 */
export async function confirmPaymentAction(form: FormData) {
  const slug = String(form.get("slug") ?? "");
  const participantId = String(form.get("participantId") ?? "");
  const newProofUrl = String(form.get("proofUrl") ?? "").trim();
  if (!slug || !participantId) return;
  if (newProofUrl && !isSafeUrl(newProofUrl)) return;

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

export async function removeParticipantAction(form: FormData) {
  const slug = String(form.get("slug") ?? "");
  const participantId = String(form.get("participantId") ?? "");
  if (!slug || !participantId) return;

  const before = (await listParticipants(slug)).find((p) => p.id === participantId);
  const removed = await removeParticipant(slug, participantId);

  if (removed) {
    await recordAction({
      ...(await actor()),
      action: "participant.remove",
      target: slug,
      detail: before
        ? `Removed participant "${before.name}" from "${slug}"`
        : `Removed a participant from "${slug}"`,
    });
  }

  revalidatePath(`/admin/tournaments/${slug}/participants`);
}
