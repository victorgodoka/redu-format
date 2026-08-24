import { NextResponse } from "next/server";
import {
  generateOAuthState,
  PLAYER_NEXT_COOKIE,
  PLAYER_OAUTH_COOKIE,
  PLAYER_STATE_COOKIE,
} from "@/lib/auth/state";
import { discordConfig } from "@/lib/discord/config";
import { safeNext } from "@/lib/safe-next";

/**
 * Site sign-in: the same Discord OAuth dance as /admin/login, minus the role
 * check - any Discord account gets a session here. What it does *not* grant is
 * the logged-in area; that still needs a Nexus token (see /login/nexus).
 */
export async function GET(request: Request) {
  const state = generateOAuthState();
  const next = safeNext(new URL(request.url).searchParams.get("next"));

  const discordUrl = new URL(discordConfig.oauthUrl);
  discordUrl.searchParams.set("client_id", discordConfig.clientId);
  discordUrl.searchParams.set("response_type", "code");
  discordUrl.searchParams.set("redirect_uri", discordConfig.playerRedirectUri);
  discordUrl.searchParams.set("scope", "identify");
  discordUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(discordUrl);
  response.cookies.set(PLAYER_STATE_COOKIE, state, PLAYER_OAUTH_COOKIE);
  response.cookies.set(PLAYER_NEXT_COOKIE, next, PLAYER_OAUTH_COOKIE);
  return response;
}
