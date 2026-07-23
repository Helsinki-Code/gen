import type { NextConfig } from "next";

const allowedOrigins = ["localhost:3000"];
if (process.env.NEXT_PUBLIC_APP_URL) {
  allowedOrigins.push(new URL(process.env.NEXT_PUBLIC_APP_URL).host);
}

const nextConfig: NextConfig = {
  output: "standalone",
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    serverActions: {
      allowedOrigins,
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "storage.googleapis.com" },
      { protocol: "https", hostname: "**.run.app" },
    ],
  },
};

export default nextConfig;
