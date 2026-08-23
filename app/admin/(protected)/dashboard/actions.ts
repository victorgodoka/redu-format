"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { recordAction } from "@/lib/audit-log";
import { establishPublicSession, fetchProfile, rateLimit } from "@/lib/auth";
import { createAdminSession, getAdminSession } from "@/lib/auth/session";
import { setAdminNexusToken } from "@/lib/backend/services/admins.service";

export type LinkNexusState = { error?: string };

/**
 * Persists the token to the admins table (survives past this admin session,
 * picked back up on the next Discord login) and re-signs the admin JWT with
 * it too (cheap reads for the rest of this session). Also establishes a
 * public/player session with the same token - see establishPublicSession.
 * The Discord identity (userId/username) is carried over unchanged.
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

  // Persisted so it survives past this admin session (picked back up
  // on the next Discord login), not just carried in the JWT below.
  await setAdminNexusToken(session.userId, token);

  await createAdminSession({
    userId: session.userId,
    username: session.username,
    displayName: session.displayName,
    nexusToken: token,
  });

  // Also signs this admin in on the public/player side with the same
  // account, so they're not asked to paste the token again at /login. Purely
  // a convenience at link time - the two sessions stay independent after
  // this (signing out of either one doesn't touch the other).
  await establishPublicSession(token);

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

  await setAdminNexusToken(session.userId, null);

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
