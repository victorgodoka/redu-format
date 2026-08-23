"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  establishPublicSession,
  fetchProfile,
  getSession,
  invalidateProfile,
  rateLimit,
} from "@/lib/auth";
import { resolvePlayerId } from "@/lib/backend/services/player.service";
import { safeNext } from "@/lib/safe-next";

export type LoginState = { error?: string };

export async function login(
  _prev: LoginState,
  form: FormData,
): Promise<LoginState> {
  const token = String(form.get("token") ?? "").trim();
  const next = safeNext(form.get("next"));
  if (!token) return { error: "Paste your Dueling Nexus token." };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (!(await rateLimit(`login:${ip}`))) {
    return { error: "Too many attempts. Wait a minute and try again." };
  }

  if (!(await establishPublicSession(token))) {
    return { error: "That token was rejected by Dueling Nexus." };
  }

  redirect(next);
}

/**
 * Re-reads the stored token now instead of waiting for the cache to lapse. Same
 * token, same API call: a revoked one comes back null and only then does the
 * user get sent back to /login for a new one.
 */
export async function refresh() {
  const session = await getSession();
  if (!session.token) redirect("/login");

  await invalidateProfile(session.token);
  const profile = await fetchProfile(session.token);

  if (!profile) {
    session.destroy();
    redirect("/login");
  }

  await resolvePlayerId(session.token, {
    name: profile.name,
    userId: profile.userId,
    avatar: profile.avatar,
    contributor: profile.contributor,
    contributorTime: profile.contributorTime,
  });

  // Keep the cookie snapshot in step, since it is what the header falls back to.
  session.name = profile.name;
  session.avatar = profile.avatar;
  session.contributor = profile.contributor;
  session.contributorTime = profile.contributorTime;
  await session.save();

  revalidatePath("/dashboard");
}

export async function logout() {
  const session = await getSession();
  session.destroy();
  redirect("/");
}

/**
 * The cleanup half of the "your Nexus token stopped working" flow: SiteHeader
 * already re-validates the token on every page load (fetchProfile), so this
 * is only ever reached after that has already failed - see
 * components/site/SessionExpiredRedirect, which calls this once its ~2s
 * spinner has run. Session-only; a linked admin token (admins.nexus_token) is
 * untouched, since that failure is the player-facing session's, not the
 * admin's own.
 */
export async function destroySessionAndRedirect() {
  const session = await getSession();
  session.destroy();
  redirect("/login");
}
