"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import Header from "./Header";
import Footer from "./Footer";
import WorkspaceAccessBanner from "./WorkspaceAccessBanner";

export default function ConditionalHeader() {
  const pathname = usePathname();

  if (pathname?.startsWith("/code-admin")) {
    return null;
  }

  if (
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/app") ||
    pathname?.startsWith("/account")
  ) {
    return null;
  }

  if (pathname?.startsWith("/sign-in") || pathname?.startsWith("/sign-up")) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      {/* Banner scrolls away; Header owns its own sticky bar (no blur wrapper) */}
      <WorkspaceAccessBanner />
      <Header />
    </Suspense>
  );
}

export function ConditionalFooter() {
  const pathname = usePathname();

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
