"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { exchangeToken, getSession, rateLimit } from "@/lib/auth";

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

  const user = await exchangeToken(token);
  if (!user) return { error: "That token was rejected by Dueling Nexus." };

  const session = await getSession();
  session.name = user.name;
  session.avatar = user.avatar;
  session.contributor = user.contributor;
  await session.save();

  redirect("/login");
}

export async function logout() {
  const session = await getSession();
  session.destroy();
  redirect("/login");
}
