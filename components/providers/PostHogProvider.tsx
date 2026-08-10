"use client";

import { useEffect, type ReactNode } from "react";

/**
 * Load PostHog after idle — never blocks first paint.
 * Children always render immediately.
 */
export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;

    let cancelled = false;

    const boot = () => {
      void import("posthog-js").then(({ default: posthog }) => {
        if (cancelled || posthog.__loaded) return;
        posthog.init(key, {
          api_host:
            process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com",
          capture_pageview: false,
        });
      });
    };

    const ric = window.requestIdleCallback?.(boot, { timeout: 5000 });
    if (ric == null) {
      const t = window.setTimeout(boot, 2500);
      return () => {
        cancelled = true;
        window.clearTimeout(t);
      };
    }
    return () => {
      cancelled = true;
      window.cancelIdleCallback?.(ric);
    };
  }, []);

  return <>{children}</>;
}
