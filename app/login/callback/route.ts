import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { establishPublicSession, setDiscordSession } from "@/lib/auth";
import {
  findPlayerByDiscordId,
  forgetNexusToken,
  rememberDiscordAccount,
} from "@/lib/backend/services/player.service";
import { avatarUrl, exchangeCode, getCurrentUser } from "@/lib/discord/client";
import { discordConfig } from "@/lib/discord/config";
import { PLAYER_NEXT_COOKIE, PLAYER_STATE_COOKIE } from "@/lib/auth/state";
import { safeNext } from "@/lib/safe-next";

/**
 * Back from Discord. Membership and roles are deliberately not consulted - the
 * site is open to anyone with a Discord account. The only gate is the Nexus
 * token: linked already and still good, and they land where they were headed;
 * otherwise they land on /login/nexus until they paste one.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const storedState = cookieStore.get(PLAYER_STATE_COOKIE)?.value;
  const next = safeNext(cookieStore.get(PLAYER_NEXT_COOKIE)?.value);

  const clear = (response: NextResponse) => {
    response.cookies.delete({ name: PLAYER_STATE_COOKIE, path: "/login" });
    response.cookies.delete({ name: PLAYER_NEXT_COOKIE, path: "/login" });
    return response;
  };

  if (url.searchParams.get("error") || !code || !state || !storedState || storedState !== state) {
    return clear(NextResponse.redirect(new URL("/login?error=discord", request.url)));
  }

  try {
    const token = await exchangeCode(code, discordConfig.playerRedirectUri);
    const user = await getCurrentUser(token.access_token);
    const discord = {
      userId: user.id,
      username: user.username,
      displayName: user.global_name ?? user.username,
      avatar: avatarUrl(user),
    };

    // Recorded on every sign-in, so a renamed handle or a new avatar does not
    // leave a stale row behind.
    await rememberDiscordAccount({
      discordUserId: discord.userId,
      username: discord.username,
      displayName: discord.displayName,
      avatarUrl: discord.avatar,
    });

    // A token linked on an earlier visit signs them straight back in. If Nexus
    // has since rejected it, it is dropped here rather than left to fail again
    // on every page load.
    const player = await findPlayerByDiscordId(user.id);
    if (player?.nexusToken && (await establishPublicSession(player.nexusToken, { discord }))) {
      return clear(NextResponse.redirect(new URL(next, request.url)));
    }
    if (player?.nexusToken) await forgetNexusToken(player.id);

    await setDiscordSession(discord);
    const gate = new URL("/login/nexus", request.url);
    gate.searchParams.set("next", next);
    return clear(NextResponse.redirect(gate));
  } catch (error) {
    console.error("Discord authentication failed:", error);
    return clear(NextResponse.redirect(new URL("/login?error=discord", request.url)));
  }
}
