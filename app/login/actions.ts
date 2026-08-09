"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { fetchProfile, getSession, rateLimit } from "@/lib/auth";

export type LoginState = { error?: string };

export async function login(
  _prev: LoginState,
  form: FormData,
): Promise<LoginState> {
  const token = String(form.get("token") ?? "").trim();
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

  redirect("/dashboard");
}

export async function logout() {
  const session = await getSession();
  session.destroy();
  redirect("/");
}
