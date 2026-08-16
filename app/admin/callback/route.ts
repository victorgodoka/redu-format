import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  exchangeCode,
  getCurrentUser,
  getGuildMember,
} from "@/lib/discord/client";

import { discordConfig } from "@/lib/discord/config";
import { createAdminSession } from "@/lib/auth/session";
import { establishPublicSession } from "@/lib/auth";
import { recordAction } from "@/lib/audit-log";
import { getAdminNexusToken, upsertAdmin } from "@/lib/backend/services/admins.service";

export async function GET(request: Request) {
  const url = new URL(request.url);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const redirectHome = () =>
    NextResponse.redirect(
      new URL("/", request.url),
    );

  if (error || !code || !state) {
    return redirectHome();
  }

  const cookieStore = await cookies();

  const storedState = cookieStore.get(
    "discord_oauth_state",
  )?.value;

  if (!storedState || storedState !== state) {
    console.error("Invalid Discord OAuth state");

    return redirectHome();
  }

  try {
    const token = await exchangeCode(code);

    const user = await getCurrentUser(
      token.access_token,
    );

    const member = await getGuildMember(user.id);

    const isModerator = member.roles.includes(
      discordConfig.modRoleId,
    );

    if (!isModerator) {
      return redirectHome();
    }

    const displayName = user.global_name ?? user.username;

    // Upsert before reading the nexus token (first login has no row yet) and
    // before recordAction, so this very login's own audit entry can already
    // resolve actor_admin_id, not just the next one.
    await upsertAdmin({
      discordUserId: user.id,
      username: user.username,
      displayName,
    });

    // Durably-linked from a previous session (see the admin dashboard's link
    // flow) - carried into the fresh admin session, and used to also sign
    // this admin in on the public/player side, so both logins stay in step
    // without asking for the token twice. The two sessions otherwise remain
    // independent: neither one's logout touches the other.
    const nexusToken = await getAdminNexusToken(user.id);

    await createAdminSession({
      userId: user.id,
      username: user.username,
      displayName,
      ...(nexusToken ? { nexusToken } : {}),
    });

    if (nexusToken) await establishPublicSession(nexusToken);

    // await recordAction({
    //   actorId: user.id,
    //   actorUsername: user.username,
    //   actorDisplayName: displayName,
    //   action: "admin.login",
    //   detail: "Signed in via Discord",
    // });

    cookieStore.delete("discord_oauth_state");

    return NextResponse.redirect(
      new URL(
        "/admin/dashboard",
        request.url,
      ),
    );
  } catch (error) {
    console.error(
      "Discord authentication failed:",
      error,
    );

    return redirectHome();
  }
}
