"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

const CACHE_KEY = "kc:maintenance";
const CACHE_TTL_MS = 5 * 60_000;

/**
 * Check maintenance mode at most once per 5 minutes (not on every navigation).
 */
export default function MaintenanceCheck({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current && pathname === "/maintenance") {
      // Still allow leave-maintenance when already on that page
    } else if (checkedRef.current) {
      return;
    }

    let cached: { at: number; on: boolean } | null = null;
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) cached = JSON.parse(raw) as { at: number; on: boolean };
    } catch {
      /* ignore */
    }

    const apply = (on: boolean) => {
      if (on && !pathname?.startsWith("/admin") && pathname !== "/maintenance") {
        router.push("/maintenance");
      } else if (!on && pathname === "/maintenance") {
        router.push("/");
      }
    };

    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      checkedRef.current = true;
      apply(cached.on);
      return;
    }

    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        const on = Boolean(data.maintenanceMode);
        try {
          sessionStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ at: Date.now(), on }),
          );
        } catch {
          /* ignore */
        }
        checkedRef.current = true;
        apply(on);
      })
      .catch(() => {
        checkedRef.current = true;
      });
  }, [pathname, router]);

  return <>{children}</>;
}
