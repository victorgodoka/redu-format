"use server";

import { recordAction } from "@/lib/audit-log";
import { getAdminSession } from "@/lib/auth/session";
import { broadcast, parseNexusIds, type MessageAudience } from "@/lib/backend/services/messages.service";

export type MessageFormState = { error?: string; sent?: string };

/**
 * Sends one markdown message to the site inbox of every player, of one
 * tournament's field, or of a hand-picked list of Nexus ids. Ids that match no
 * account come back in the result rather than failing the whole send - a typo
 * in a list of thirty shouldn't cost the other twenty-nine their message.
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
    const nexusIds = parseNexusIds(String(form.get("nexusIds") ?? ""));
    if (nexusIds.length === 0) return { error: "Enter at least one Nexus ID." };
    audience = { kind: "players", nexusIds };
  } else {
    audience = { kind: "all" };
  }

  const result = await broadcast({ title, body, audience });
  if (result.sent === 0) {
    return { error: "That reached nobody - no matching player has an account here." };
  }

  const session = await getAdminSession();
  const reach = result.sent === null ? "every player" : `${result.sent} player(s)`;
  await recordAction({
    actorId: session?.userId ?? "unknown",
    actorUsername: session?.username ?? "unknown",
    actorDisplayName: session?.displayName ?? "unknown",
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
