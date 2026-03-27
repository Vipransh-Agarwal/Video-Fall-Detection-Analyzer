import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow large video file uploads (up to 100MB)
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
};

export default nextConfig;
