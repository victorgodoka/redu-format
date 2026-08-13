"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  fetchProfile,
  getSession,
  invalidateProfile,
  rateLimit,
} from "@/lib/auth";
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
  if (!rateLimit(ip)) {
    return { error: "Too many attempts. Wait a minute and try again." };
  }

  const profile = await fetchProfile(token);
  if (!profile) return { error: "That token was rejected by Dueling Nexus." };

  const session = await getSession();
  session.token = token;
  session.name = profile.name;
  session.avatar = profile.avatar;
  session.contributor = profile.contributor;
  session.contributorTime = profile.contributorTime;
  await session.save();

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

  invalidateProfile(session.token);
  const profile = await fetchProfile(session.token);

  if (!profile) {
    session.destroy();
    redirect("/login");
  }

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
