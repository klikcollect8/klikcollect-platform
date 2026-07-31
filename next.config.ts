import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Enable static export for Capacitor
  output: process.env.CAPACITOR === 'true' ? 'export' : undefined,
  // Ensure Turbopack uses this project root (avoids picking parent folder)
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    unoptimized: process.env.CAPACITOR === 'true',
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  // Disable trailing slash for Capacitor compatibility
  trailingSlash: false,
};

export default nextConfig;
