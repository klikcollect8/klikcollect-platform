/** Canonical public site — phones can open this (not localhost). */
export const PRODUCTION_APP_URL = "https://klikcollect-platform.vercel.app";

function isLocalHost(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".local")
  );
}

/**
 * URL for PWA install QR / share.
 * Prefer NEXT_PUBLIC_APP_URL, then current origin if public, else production.
 */
export function getPublicAppUrl(pageOrigin?: string): string {
  const configured = (process.env.NEXT_PUBLIC_APP_URL || "")
    .trim()
    .replace(/\/$/, "");
  if (configured) {
    try {
      if (!isLocalHost(new URL(configured).hostname)) return configured;
    } catch {
      /* ignore */
    }
  }

  if (pageOrigin) {
    try {
      const u = new URL(pageOrigin);
      if (!isLocalHost(u.hostname)) return u.origin;
    } catch {
      /* ignore */
    }
  }

  return PRODUCTION_APP_URL;
}
