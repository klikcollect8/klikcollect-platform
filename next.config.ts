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
  experimental: {
    optimizePackageImports: ["lucide-react", "@clerk/nextjs", "sonner"],
  },
  images: {
    unoptimized: process.env.CAPACITOR === "true",
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
  // Disable trailing slash for Capacitor compatibility
  trailingSlash: false,
};

export default nextConfig;
