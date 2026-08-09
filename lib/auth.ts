import "server-only";

import { createHash } from "node:crypto";
import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import {
  cleanAvatar,
  parseContributor,
  parseDeck,
  type NexusDeck,
} from "./nexus-parse";

const NEXUS_INFO = "https://duelingnexus.com/api/get-info.php";

/** Nexus returns HTTP 200 with `success: false` on a bad token, so only the body is trustworthy. */
export type NexusProfile = {
  name: string;
  /** Absolute URL on duelingnexus.com, or "" when absent/untrusted. */
  avatar: string;
  contributor: boolean;
  /** Unit unconfirmed, never rendered. See parseContributor. */
  contributorTime: number;
  decks: NexusDeck[];
};

/**
 * The Nexus token is the only credential that can read a user's decks, so it
 * rides along inside the encrypted cookie. iron-session seals the payload, so
 * the browser holds ciphertext it cannot read and JS cannot reach it (httpOnly).
 * ponytail: swap for a random session id plus a server-side store if the token
 * should never leave the server at all.
 */
export type Session = {
  token?: string;
  name?: string;
  avatar?: string;
  contributor?: boolean;
  contributorTime?: number;
};

export { cleanAvatar, parseContributor, parseDeck } from "./nexus-parse";
export type { NexusDeck } from "./nexus-parse";

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

// ponytail: per-instance memory with a hard cap, so it does not span serverless
// workers. Redis if the API load ever justifies it.
const CACHE_TTL = 60_000;
const CACHE_MAX = 500;
const profiles = new Map<string, { profile: NexusProfile; expires: number }>();

/** Keyed by a digest so the raw credential is not sitting in a map key. */
function cacheKey(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Reads the profile and deck list behind a Nexus token. Nexus answers HTTP 200
 * with `success: false` for a bad token, so only the body decides. Returns null
 * for anything that is not a confirmed success, which is also how a revoked
 * token surfaces on later reads.
 */
export async function fetchProfile(token: string): Promise<NexusProfile | null> {
  // Cheap shape check first, so obvious junk never reaches the upstream API.
  if (!/^[A-Za-z0-9._-]{8,256}$/.test(token)) return null;

  const key = cacheKey(token);
  const hit = profiles.get(key);
  if (hit && Date.now() < hit.expires) return hit.profile;

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
    profiles.delete(key);
    return null;
  }

  const { name, avatar, contributor, deck } = payload as Record<string, unknown>;
  if (typeof name !== "string" || name.length === 0) return null;

  const profile: NexusProfile = {
    name,
    avatar: cleanAvatar(avatar),
    ...parseContributor(contributor),
    decks: (Array.isArray(deck) ? deck : [])
      .map(parseDeck)
      .filter((d): d is NexusDeck => d !== null),
  };

  if (profiles.size >= CACHE_MAX) profiles.clear();
  profiles.set(key, { profile, expires: Date.now() + CACHE_TTL });

  return profile;
}

export { rateLimit } from "./rate-limit";
