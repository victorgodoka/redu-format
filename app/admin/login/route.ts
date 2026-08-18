import { NextResponse } from "next/server";
import { generateOAuthState } from "@/lib/auth/state";
import { discordConfig } from "@/lib/discord/config";
import { ADMIN_NEXT_COOKIE } from "@/lib/auth/session";
import { safeNext } from "@/lib/safe-next";

export async function GET(request: Request) {
  const state = generateOAuthState();
  // Where the middleware turned them away from, validated before it is stored
  // so only a path on this origin can ever come back out of the cookie.
  const next = safeNext(new URL(request.url).searchParams.get("next"), "/admin/dashboard");

  const discordUrl = new URL(discordConfig.oauthUrl);

  discordUrl.searchParams.set(
    "client_id",
    discordConfig.clientId,
  );

  discordUrl.searchParams.set(
    "response_type",
    "code",
  );

  discordUrl.searchParams.set(
    "redirect_uri",
    discordConfig.redirectUri,
  );

  discordUrl.searchParams.set(
    "scope",
    "identify",
  );

  discordUrl.searchParams.set(
    "state",
    state,
  );

  const response = NextResponse.redirect(discordUrl);

  response.cookies.set("discord_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    maxAge: 60 * 10, // 10 minutes
  });

  response.cookies.set(ADMIN_NEXT_COOKIE, next, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    maxAge: 60 * 10,
  });

  return response;
}
