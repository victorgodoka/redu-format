import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker: ships a self-contained server.js with only the deps it traced.
  output: "standalone",
  // A bind-mounted volume delivers no inotify events, so Turbopack's watcher
  // never sees host edits and hot reload dies. Only the container sets
  // DOCKER_DEV - polling on a normal host would burn CPU for nothing.
  watchOptions: process.env.DOCKER_DEV ? { pollIntervalMs: 500 } : undefined,
  // lib/cardinfo.json is read at runtime (lib/tcg-decks.ts), not imported, so
  // the tracer has to be told to ship it with the server bundle.
  outputFileTracingIncludes: {
    "/**": ["./lib/cardinfo.json"],
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "duelingnexus.com",
        pathname: "/uploads/avatars/**",
      },
      {
        protocol: "https",
        hostname: "yugi.wiki",
        pathname: "/assets/card-images/**",
      },
      {
        protocol: "https",
        hostname: "ygopro.online",
        pathname: "/assets/card-arts/**",
      },
      {
        protocol: "https",
        hostname: "ygopro.online",
        pathname: "/assets/profile/Avatars/**",
      },
    ],
  },
};

export default nextConfig;
