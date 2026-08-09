import "server-only";

import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

const NEXUS_INFO = "https://duelingnexus.com/api/get-info.php";

/** Nexus returns HTTP 200 with `success: false` on a bad token, so only the body is trustworthy. */
export type NexusUser = {
  name: string;
  avatar: string;
  contributor: string;
};

export type Session = {
  name?: string;
  avatar?: string;
  contributor?: string;
};

// Read at call time, not import time, so a missing secret fails the request
// rather than the build.
function options(): SessionOptions {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set to at least 32 characters. Generate one with: openssl rand -base64 32",
    );
  }
  return {
    password,
    cookieName: "redu_session",
    ttl: 60 * 60 * 24 * 7,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
  };
}

export async function getSession() {
  return getIronSession<Session>(await cookies(), options());
}

/**
 * Trades a Nexus token for the public profile behind it. The token is used for
 * this one call and never stored, logged, or handed back to the browser.
 */
export async function exchangeToken(token: string): Promise<NexusUser | null> {
  // Cheap shape check first, so obvious junk never reaches the upstream API.
  if (!/^[A-Za-z0-9._-]{8,256}$/.test(token)) return null;

  let payload: unknown;
  try {
    const res = await fetch(`${NEXUS_INFO}?token=${encodeURIComponent(token)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    payload = await res.json();
  } catch {
    return null;
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    (payload as { success?: unknown }).success !== true
  ) {
    return null;
  }

  const { name, avatar, contributor } = payload as Record<string, unknown>;
  if (typeof name !== "string" || name.length === 0) return null;

  return {
    name,
    avatar: typeof avatar === "string" ? avatar : "",
    contributor: typeof contributor === "string" ? contributor : "",
  };
}

export { rateLimit } from "./rate-limit";
