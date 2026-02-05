import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Allows production builds even with TS errors
    ignoreBuildErrors: true,
  },
  eslint: {
    // Allows production builds even with ESLint errors
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
