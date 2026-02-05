import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Allows production builds even with TS errors
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
