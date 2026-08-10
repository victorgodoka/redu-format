"use server";

import { revalidatePath } from "next/cache";
import { addParticipant, removeParticipant } from "@/lib/tournaments";

export async function addParticipantAction(form: FormData) {
  const slug = String(form.get("slug") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const deckName = String(form.get("deckName") ?? "").trim();
  if (!slug || !name || !deckName) return;

  await addParticipant(slug, { name, deckName });
  revalidatePath(`/admin/tournaments/${slug}/participants`);
}

export async function removeParticipantAction(form: FormData) {
  const slug = String(form.get("slug") ?? "");
  const participantId = String(form.get("participantId") ?? "");
  if (!slug || !participantId) return;

  await removeParticipant(slug, participantId);
  revalidatePath(`/admin/tournaments/${slug}/participants`);
}
