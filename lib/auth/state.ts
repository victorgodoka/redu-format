import { randomBytes } from "node:crypto";

export function generateOAuthState(): string {
  return randomBytes(32).toString("hex");
}

/** The player sign-in's CSRF state and its post-login destination, scoped to /login. */
export const PLAYER_STATE_COOKIE = "player_oauth_state";
export const PLAYER_NEXT_COOKIE = "player_next";

/** Shared by the route that sets these and the callback that clears them. */
export const PLAYER_OAUTH_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/login",
  maxAge: 60 * 10,
} as const;
