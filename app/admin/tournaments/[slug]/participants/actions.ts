"use server";

import { revalidatePath } from "next/cache";
import { recordAction } from "@/lib/audit-log";
import { getAdminSession } from "@/lib/auth/session";
import { listParticipants, addParticipant, removeParticipant } from "@/lib/tournaments";

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
