import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
