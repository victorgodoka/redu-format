import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
