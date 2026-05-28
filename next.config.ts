import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Skip type checking during build
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;