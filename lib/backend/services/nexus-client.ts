/**
 * The one client for the two Nexus endpoints duel-verification.service.ts
 * needs. Deliberately separate from lib/auth.ts's fetchProfile(): that one
 * caches a *player's own* profile for display (60s TTL, per-token), which is
 * the wrong shape and the wrong cache policy for polling *replays* on a
 * schedule the 5-minute nexus_fetch_log already governs (see
 * nexus-fetch-log.repository.ts) - two callers, two concerns, one fetch each.
 */
import { NEXUS_GET_INFO_URL, NEXUS_GET_REPLAY_INFO_URL, parseReplayData, parseReplays, type NexusReplay, type NexusReplayData } from "../../nexus-parse.ts";

async function getJson(url: string): Promise<unknown> {
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    return await res.json();
  } catch {
    return null;
  }
}

/** Recent replays visible to this Nexus token - see duel-verification.service.ts for which token is used and why. Null on any failure (never treated as "no replays"). */
export async function fetchNexusReplayList(token: string): Promise<NexusReplay[] | null> {
  const payload = await getJson(`${NEXUS_GET_INFO_URL}?token=${encodeURIComponent(token)}`);
  if (typeof payload !== "object" || payload === null || (payload as { success?: unknown }).success !== true) {
    return null;
  }
  return parseReplays((payload as Record<string, unknown>).replays);
}

/** Full result data for one replay. Null on failure or a malformed body - never guessed at. */
export async function fetchNexusReplayDetails(replayId: string): Promise<NexusReplayData | null> {
  const payload = await getJson(`${NEXUS_GET_REPLAY_INFO_URL}?id=${encodeURIComponent(replayId)}`);
  if (typeof payload !== "object" || payload === null || (payload as { success?: unknown }).success !== true) {
    return null;
  }
  return parseReplayData((payload as Record<string, unknown>).replay_data);
}
