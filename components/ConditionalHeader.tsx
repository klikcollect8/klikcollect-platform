"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import Header from "./Header";
import Footer from "./Footer";
import WorkspaceAccessBanner from "./WorkspaceAccessBanner";

export default function ConditionalHeader() {
  const pathname = usePathname();

  // Don't show header on admin login page
  if (pathname?.startsWith("/code-admin")) {
    return null;
  }

  // Don't show storefront header on OS / admin / account shells
  if (
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/app") ||
    pathname?.startsWith("/account")
  ) {
    return null;
  }

  // Don't show header on auth pages (they have their own layouts)
  if (pathname?.startsWith("/sign-in") || pathname?.startsWith("/sign-up")) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      {/* Sticky stack so the workspace banner stays visible on mobile scroll */}
      <div className="sticky top-0 z-40">
        <WorkspaceAccessBanner />
        <Header />
      </div>
    </Suspense>
  );
}

export function ConditionalFooter() {
  const pathname = usePathname();

  // Don't show footer on OS / admin shells or branded auth pages
  if (
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/app") ||
    pathname?.startsWith("/account") ||
    pathname?.startsWith("/sign-in") ||
    pathname?.startsWith("/sign-up") ||
    pathname?.startsWith("/sign-out")
  ) {
    return null;
  }

  return <Footer />;
}
