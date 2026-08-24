"use server";

import { recordAction } from "@/lib/audit-log";
import { getAdminSession } from "@/lib/auth/session";
import { broadcast, type MessageAudience } from "@/lib/backend/services/messages.service";

export type MessageFormState = { error?: string; sent?: string };

/**
 * Sends one markdown message to the site inbox of every player, of one
 * tournament's field, or of a hand-picked list of players. Names that match no
 * account come back in the result rather than failing the whole send - one
 * stale name in a list of thirty shouldn't cost the other twenty-nine their
 * message. The sending admin is signed onto the message itself.
 */
export async function sendMessageAction(
  _prev: MessageFormState,
  form: FormData,
): Promise<MessageFormState> {
  const title = String(form.get("title") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  if (!title) return { error: "Title is required." };
  if (!body) return { error: "Message is required." };

  const kind = String(form.get("audience") ?? "all");
  let audience: MessageAudience;
  if (kind === "tournament") {
    const slug = String(form.get("slug") ?? "").trim();
    if (!slug) return { error: "Pick a tournament." };
    audience = { kind: "tournament", slug };
  } else if (kind === "players") {
    const names = form.getAll("players").map((v) => String(v).trim()).filter(Boolean);
    if (names.length === 0) return { error: "Pick at least one player." };
    audience = { kind: "players", names };
  } else {
    audience = { kind: "all" };
  }

  const session = await getAdminSession();
  const sentBy = session?.displayName ?? session?.username ?? "REDU staff";

  const result = await broadcast({ title, body, audience, sentBy });
  if (result.sent === 0) {
    return { error: "That reached nobody - no matching player has an account here." };
  }

  const reach = result.sent === null ? "every player" : `${result.sent} player(s)`;
  await recordAction({
    actorId: session?.userId ?? "unknown",
    actorUsername: session?.username ?? "unknown",
    actorDisplayName: sentBy,
    action: "message.send",
    target: kind === "tournament" ? String(form.get("slug") ?? "") : kind,
    detail: `Sent "${title}" to ${reach}`,
  });

  return {
    sent:
      `Sent to ${reach}.` +
      (result.unknown.length > 0 ? ` No account matched: ${result.unknown.join(", ")}.` : ""),
  };
}
