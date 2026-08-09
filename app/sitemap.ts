import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: "https://reduformat.com", changeFrequency: "weekly" }];
}
