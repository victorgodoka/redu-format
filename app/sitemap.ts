import type { MetadataRoute } from "next";
import { FEATURED_EVENT, isFinished } from "@/lib/events";
import { SITE_URL } from "@/lib/site";
import { listTournaments } from "@/lib/tournaments";

/**
 * Built per request, not at build time. Every other route pulls in SiteHeader
 * (which reads the session cookie) and is dynamic already, so this was the one
 * page Next prerendered - which made `next build` depend on the database being
 * reachable, and fail the whole deploy when it was not. It also means a new
 * tournament shows up here without a rebuild.
 */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // A sitemap missing the tournaments is worth far more than a 500: crawlers
  // still get the fixed pages, and the next crawl picks the rest back up.
  const tournaments = await listTournaments().catch(() => []);

  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/events`, changeFrequency: "daily", priority: 0.9 },
    {
      url: `${SITE_URL}/events/${FEATURED_EVENT.slug}`,
      changeFrequency: "yearly",
      priority: 0.7,
    },
    ...tournaments.map((t) => ({
      url: `${SITE_URL}/events/${t.slug}`,
      changeFrequency: isFinished(t) ? ("yearly" as const) : ("daily" as const),
      priority: isFinished(t) ? 0.7 : 0.8,
    })),
    { url: `${SITE_URL}/banlist`, changeFrequency: "yearly", priority: 0.8 },
    { url: `${SITE_URL}/rulings`, changeFrequency: "yearly", priority: 0.8 },
    {
      url: `${SITE_URL}/leaderboard`,
      changeFrequency: "weekly",
      priority: 0.6,
    },
  ];
}
