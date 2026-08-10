/**
 * Shared helpers for post-auth return paths (middleware, /sign-in bridge, SSO).
 */

const PROTECTED_PREFIXES = ["/app", "/admin", "/account", "/checkout"];

export const AUTH_REDIRECT_STORAGE_KEY = "kc_auth_redirect";

/** Resolve return path from either `redirect` or Clerk-style `redirect_url`. */
export function resolveAuthReturnPath(
  searchParams: URLSearchParams | { get: (k: string) => string | null },
): string {
  const raw =
    searchParams.get("redirect")?.trim() ||
    searchParams.get("redirect_url")?.trim() ||
    "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  if (raw.startsWith("/sign-in") || raw.startsWith("/sign-up")) return "/";
  return raw;
}

/** Paths that bounce unsigned users — do not navigate here before auth completes. */
export function isProtectedReturnPath(path: string): boolean {
  const base = path.split("?")[0] || path;
  return PROTECTED_PREFIXES.some(
    (p) => base === p || base.startsWith(`${p}/`) || base.startsWith(`${p}?`),
  );
}

/** Safe page to land on while the auth modal is open. */
export function publicLandingForAuth(returnPath: string): string {
  if (!isProtectedReturnPath(returnPath)) return returnPath;
  if (returnPath.startsWith("/checkout")) return "/cart";
  if (returnPath.startsWith("/account")) return "/";
  if (returnPath.startsWith("/app")) return "/";
  if (returnPath.startsWith("/admin")) return "/";
  return "/";
}

export function persistAuthRedirect(path: string) {
  if (typeof window === "undefined") return;
  const safe =
    path.startsWith("/") && !path.startsWith("//") ? path : "/";
  try {
    sessionStorage.setItem(AUTH_REDIRECT_STORAGE_KEY, safe);
  } catch {
    /* ignore */
  }
}

export function consumeAuthRedirect(fallback = "/"): string {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = sessionStorage.getItem(AUTH_REDIRECT_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_REDIRECT_STORAGE_KEY);
    if (raw?.startsWith("/") && !raw.startsWith("//")) return raw;
  } catch {
    /* ignore */
  }
  return fallback;
}
