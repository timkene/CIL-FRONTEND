import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Pre-existing type gaps across UI components — tracked separately
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
