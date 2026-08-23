import "server-only";

import { createHash } from "node:crypto";
import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { cache } from "react";
import {
  cleanAvatar,
  NEXUS_GET_INFO_URL,
  NexusDeckLists,
  parseContributor,
  parseDeck,
  parseDeckList,
  parseUserId,
  type NexusDeck,
} from "./nexus-parse";
import {
  getCachedProfile,
  invalidateCachedProfile,
  setCachedProfile,
} from "./backend/services/nexus-cache.service";
import { enforcePlayerDecks } from "./backend/services/deck-watch.service";
import { resolvePlayerId } from "./backend/services/player.service";

/** Nexus returns HTTP 200 with `success: false` on a bad token, so only the body is trustworthy. */
export type NexusProfile = {
  name: string;
  /** Nexus's own internal player id - the canonical identity for matching replay players. "" when absent. */
  userId: string;
  /** Absolute URL on duelingnexus.com, or "" when absent/untrusted. */
  avatar: string;
  contributor: boolean;
  /** Unit unconfirmed, never rendered. See parseContributor. */
  contributorTime: number;
  decks: NexusDeck[];
  deckLists: NexusDeckLists[];
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

export {
  cleanAvatar,
  deckLegality,
  parseContributor,
  parseDeck,
} from "./nexus-parse";
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

// L1: per-instance memory, near-free when warm but not shared across Vercel's
// serverless instances. L2 is the nexus_profile_cache table (see
// lib/backend/services/nexus-cache.service.ts), shared across instances - a
// warm instance still skips the DB round trip via this Map, a cold or
// different instance still gets the shared cache instead of hitting Nexus.
const CACHE_TTL = 60_000;
const CACHE_MAX = 500;
const profiles = new Map<string, { profile: NexusProfile; expires: number }>();

/** Keyed by a digest so the raw credential is not sitting in a map key. */
function cacheKey(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Drops the cached copy (both tiers) so the next read hits Nexus. Backs the refresh button. */
export async function invalidateProfile(token: string) {
  const key = cacheKey(token);
  profiles.delete(key);
  await invalidateCachedProfile(key);
}

/**
 * Reads the profile and deck list behind a Nexus token. Nexus answers HTTP 200
 * with `success: false` for a bad token, so only the body decides. Returns null
 * for anything that is not a confirmed success, which is also how a revoked
 * token surfaces on later reads.
 */
// React.cache() dedupes repeat calls with the same token inside one request
// (e.g. SiteHeader and the page both reading the session), on top of the
// cross-request Map cache above.
export const fetchProfile = cache(async function fetchProfile(
  token: string,
): Promise<NexusProfile | null> {
  // Cheap shape check first, so obvious junk never reaches the upstream API.
  if (!/^[A-Za-z0-9._-]{8,256}$/.test(token)) return null;

  const key = cacheKey(token);
  const hit = profiles.get(key);
  if (hit && Date.now() < hit.expires) return hit.profile;

  const dbHit = await getCachedProfile<NexusProfile>(key);
  if (dbHit) {
    // Mirror the DB row's real expiry into L1, not a fresh CACHE_TTL window -
    // otherwise a warm instance re-reading a near-expired entry would keep
    // resetting its own clock and the cache would never truly expire.
    if (profiles.size >= CACHE_MAX) profiles.clear();
    profiles.set(key, { profile: dbHit.value, expires: dbHit.expiresAt });
    return dbHit.value;
  }

  let payload: unknown;
  try {
    const res = await fetch(`${NEXUS_GET_INFO_URL}?token=${encodeURIComponent(token)}`, {
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
    await invalidateCachedProfile(key);
    return null;
  }

  const { name, user_id, avatar, contributor, deck } = payload as Record<string, string>;
  if (typeof name !== "string" || name.length === 0) return null;

  const profile: NexusProfile = {
    name,
    userId: parseUserId(user_id),
    avatar: avatar,
    ...parseContributor(contributor),
    decks: (Array.isArray(deck) ? deck : [])
      .map(parseDeck)
      .filter((d): d is NexusDeck => d !== null),
    deckLists: (Array.isArray(deck) ? deck : [])
      .map(parseDeckList)
      .filter((d): d is NexusDeckLists => d !== null),
  };

  if (profiles.size >= CACHE_MAX) profiles.clear();
  profiles.set(key, { profile, expires: Date.now() + CACHE_TTL });
  await setCachedProfile(key, profile, CACHE_TTL);

  return profile;
});

/**
 * Populates the public player session (the same one /login's form sets) from
 * a Nexus token that's already known-good elsewhere - the admin dashboard's
 * link flow, so linking a token there also signs the admin in as a player,
 * without asking them to paste it again at /login. Best-effort: a revoked
 * token just means no public session gets created, not an error the caller
 * needs to handle.
 */
export async function establishPublicSession(token: string): Promise<boolean> {
  const profile = await fetchProfile(token);
  if (!profile) return false;

  const playerId = await resolvePlayerId(token, {
    name: profile.name,
    userId: profile.userId,
    avatar: profile.avatar,
    contributor: profile.contributor,
    contributorTime: profile.contributorTime,
  });

  // Signing in is one of the deck-lock checkpoints, alongside every new round
  // and every visit (SiteHeader).
  await enforcePlayerDecks(playerId).catch(() => 0);

  const session = await getSession();
  session.token = token;
  session.name = profile.name;
  session.avatar = profile.avatar;
  session.contributor = profile.contributor;
  session.contributorTime = profile.contributorTime;
  await session.save();

  return true;
}

export { rateLimit } from "./rate-limit";
