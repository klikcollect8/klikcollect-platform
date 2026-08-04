import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Optional static export (native app uses remote CAPACITOR_SERVER_URL instead)
  output: process.env.CAPACITOR === "true" ? "export" : undefined,
  // Ensure Turbopack uses this project root (avoids picking parent folder)
  turbopack: {
    root: path.resolve(__dirname),
  },
  transpilePackages: ["mapbox-gl"],
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
