import type { MetadataRoute } from "next";
import { FEATURED_EVENT } from "@/lib/events";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/events`, changeFrequency: "daily", priority: 0.9 },
    {
      url: `${SITE_URL}/events/${FEATURED_EVENT.slug}`,
      changeFrequency: "yearly",
      priority: 0.7,
    },
    { url: `${SITE_URL}/banlist`, changeFrequency: "yearly", priority: 0.8 },
    { url: `${SITE_URL}/rulings`, changeFrequency: "yearly", priority: 0.8 },
    {
      url: `${SITE_URL}/leaderboard`,
      changeFrequency: "weekly",
      priority: 0.6,
    },
  ];
}
