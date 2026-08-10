"use client";

import { useEffect, useRef } from "react";
import { useAuth, useClerk } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";

const COOLDOWN_MS = 60_000;
const COOLDOWN_KEY = "kc:clerk-recovery-at";

function isClerkNetworkError(reason: unknown): boolean {
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === "string"
        ? reason
        : "";
  // Only Clerk-branded failures — never generic "Failed to fetch" (cart/Mapbox/etc).
  return /ClerkJS:\s*Network error|clerk\.com|session\.touch|Clerk:\s/i.test(
    message,
  );
}

function recoveryAllowed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = sessionStorage.getItem(COOLDOWN_KEY);
    const at = raw ? Number(raw) : 0;
    if (Number.isFinite(at) && Date.now() - at < COOLDOWN_MS) return false;
    sessionStorage.setItem(COOLDOWN_KEY, String(Date.now()));
    return true;
  } catch {
    return true;
  }
}

/**
 * When Clerk session.touch fails (stale cookie / blocked Clerk network),
 * clear the broken session so admin login can recover — with cooldown so
 * unrelated network errors never force mass sign-outs under load.
 */
export default function ClerkSessionRecovery() {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { signOut } = useClerk();
  const clearingRef = useRef(false);

  useEffect(() => {
    const clearBrokenSession = async () => {
      if (clearingRef.current || !recoveryAllowed()) return;
      clearingRef.current = true;
      try {
        await signOut({ redirectUrl: undefined });
      } catch {
        /* ignore — hard navigate below still recovers */
      }
      const onAdmin = pathname?.startsWith("/admin");
      const onAuthSurface =
        pathname === "/admin/login" ||
        pathname?.startsWith("/admin/login") ||
        pathname?.startsWith("/sign-in") ||
        pathname?.startsWith("/sign-up");
      if (!onAuthSurface) {
        const target = onAdmin
          ? `/admin/login?redirect=${encodeURIComponent(pathname || "/admin")}`
          : "/";
        router.replace(target);
      }
      clearingRef.current = false;
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      if (!isClerkNetworkError(event.reason)) return;
      event.preventDefault();
      void clearBrokenSession();
    };

    const onError = (event: ErrorEvent) => {
      if (!isClerkNetworkError(event.error || event.message)) return;
      event.preventDefault();
      void clearBrokenSession();
    };

    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, [pathname, router, signOut]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (!pathname?.startsWith("/admin")) return;
    if (pathname.startsWith("/admin/login")) return;

    let cancelled = false;
    void (async () => {
      try {
        await getToken();
      } catch (err) {
        if (cancelled || !isClerkNetworkError(err) || !recoveryAllowed()) return;
        try {
          await signOut({ redirectUrl: undefined });
        } catch {
          /* ignore */
        }
        router.replace(
          `/admin/login?redirect=${encodeURIComponent(pathname || "/admin")}`,
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, pathname, router, signOut]);

  return null;
}
