import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use Webpack instead of Turbopack for better compatibility
  experimental: {
    // Enable Turbopack for development
  },
  // Ensure proper build settings
  typescript: {
    // Skip type checking during build to avoid errors
    ignoreBuildErrors: false,
  },
  eslint: {
    // Ignore ESLint errors during build
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;