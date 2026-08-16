"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { recordAction } from "@/lib/audit-log";
import { fetchProfile, rateLimit } from "@/lib/auth";
import { createAdminSession, getAdminSession } from "@/lib/auth/session";

export type LinkNexusState = { error?: string };

/**
 * Re-signs the admin JWT with the token attached, so the link survives page
 * reloads for the rest of the 8-hour admin session. The Discord identity
 * (userId/username) is carried over unchanged.
 */
export async function linkNexusToken(
  _prev: LinkNexusState,
  form: FormData,
): Promise<LinkNexusState> {
  const session = await getAdminSession();
  if (!session) return { error: "Your admin session expired. Sign in again." };

  const token = String(form.get("token") ?? "").trim();
  if (!token) return { error: "Paste your Dueling Nexus token." };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (!(await rateLimit(`nexus-link:${ip}`))) {
    return { error: "Too many attempts. Wait a minute and try again." };
  }

  const profile = await fetchProfile(token);
  if (!profile) return { error: "That token was rejected by Dueling Nexus." };

  await createAdminSession({
    userId: session.userId,
    username: session.username,
    displayName: session.displayName,
    nexusToken: token,
  });

  // Never log the raw token: the linked profile's name is enough context.
  await recordAction({
    actorId: session.userId,
    actorUsername: session.username,
    actorDisplayName: session.displayName,
    action: "nexus.link",
    detail: `Linked Dueling Nexus account "${profile.name}"`,
  });

  revalidatePath("/admin/dashboard");
  return {};
}

export async function unlinkNexusToken() {
  const session = await getAdminSession();
  if (!session) return;

  await createAdminSession({
    userId: session.userId,
    username: session.username,
    displayName: session.displayName,
  });

  if (session.nexusToken) {
    await recordAction({
      actorId: session.userId,
      actorUsername: session.username,
      actorDisplayName: session.displayName,
      action: "nexus.unlink",
      detail: "Unlinked Dueling Nexus account",
    });
  }

  revalidatePath("/admin/dashboard");
}
