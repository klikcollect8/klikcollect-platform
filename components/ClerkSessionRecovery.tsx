"use client";

import { useEffect } from "react";
import { useAuth, useClerk } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";

function isClerkNetworkError(reason: unknown): boolean {
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === "string"
        ? reason
        : "";
  return /ClerkJS:\s*Network error|Failed to fetch/i.test(message);
}

/**
 * When Clerk session.touch fails (stale cookie / blocked network),
 * clear the broken session so admin login can recover instead of looping.
 */
export default function ClerkSessionRecovery() {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { signOut } = useClerk();

  useEffect(() => {
    let clearing = false;

    const clearBrokenSession = async () => {
      if (clearing) return;
      clearing = true;
      try {
        await signOut({ redirectUrl: undefined });
      } catch {
        /* ignore — hard navigate below still recovers */
      }
      const onAdmin = pathname?.startsWith("/admin");
      const target = onAdmin
        ? `/admin/login?redirect=${encodeURIComponent(pathname || "/admin")}`
        : "/";
      router.replace(target);
      clearing = false;
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

    let cancelled = false;
    void (async () => {
      try {
        await getToken();
      } catch (err) {
        if (cancelled || !isClerkNetworkError(err)) return;
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
