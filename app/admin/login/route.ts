import { NextResponse } from "next/server";
import { generateOAuthState } from "@/lib/auth/state";
import { discordConfig } from "@/lib/discord/config";

export async function GET(request: Request) {
  const state = generateOAuthState();

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

  return response;
}
