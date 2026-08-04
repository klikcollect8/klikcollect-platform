"use client";

import { usePathname } from "next/navigation";
import { showsMobileBottomNav } from "@/lib/mobile-nav";
import { cn } from "@/lib/utils";

/** Root content wrapper — clears fixed mobile bottom nav without double-padding. */
export default function ShellMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <main
      className={cn(
        showsMobileBottomNav(pathname) && "kc-mobile-nav-pad",
      )}
    >
      {children}
    </main>
  );
}
