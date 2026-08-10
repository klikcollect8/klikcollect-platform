"use client";

import ConditionalHeader, {
  ConditionalFooter,
} from "@/components/ConditionalHeader";
import BottomNav from "@/components/BottomNav";
import ShellMain from "@/components/ShellMain";
import { showsMobileBottomNav } from "@/lib/mobile-nav";
import { usePathname } from "next/navigation";

/**
 * Mobile storefront: docked shell — top chrome + bottom tabs sit outside the
 * scroll area so they stay pinned. Desktop uses normal document scroll.
 */
export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const docked = showsMobileBottomNav(pathname);

  if (!docked) {
    return (
      <>
        <ConditionalHeader />
        <ShellMain>{children}</ShellMain>
        <ConditionalFooter />
      </>
    );
  }

  return (
    <div className="kc-app-shell kc-app-shell--docked">
      <div className="kc-app-top">
        <ConditionalHeader />
      </div>
      <div className="kc-app-scroll">
        <ShellMain>{children}</ShellMain>
        <ConditionalFooter />
      </div>
      <BottomNav />
    </div>
  );
}
