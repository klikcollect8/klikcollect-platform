"use client";

import ConditionalHeader, {
  ConditionalFooter,
} from "@/components/ConditionalHeader";
import BottomNav from "@/components/BottomNav";
import ShellMain from "@/components/ShellMain";
import { showsMobileBottomNav } from "@/lib/mobile-nav";
import { usePathname } from "next/navigation";

/**
 * On mobile storefront routes the page scrolls inside a docked shell so the
 * bottom tab bar is a real sibling under the scroll area — not position:fixed.
 * That way it cannot drift mid-page while scrolling.
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
      <div className="kc-app-scroll">
        <ConditionalHeader />
        <ShellMain>{children}</ShellMain>
        <ConditionalFooter />
      </div>
      <BottomNav />
    </div>
  );
}
