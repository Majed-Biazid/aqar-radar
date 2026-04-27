import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.aqar.fm",
        pathname: "/**",
      },
    ],
  },
  // better-sqlite3 is a native module — exclude from bundling for route handlers
  serverExternalPackages: ["better-sqlite3"],
  async headers() {
    return [
      {
        // Service worker must never be cached by the browser — otherwise users
        // get stuck on a stale SW after we ship a new app version.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
