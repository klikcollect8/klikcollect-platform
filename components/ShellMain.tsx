"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Root content wrapper — no storefront bottom padding on OS shells. */
export default function ShellMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const isOsShell =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/app") ||
    pathname.startsWith("/account") ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up");

  return (
    <main className={cn(!isOsShell && "kc-mobile-nav-pad")}>{children}</main>
  );
}
