"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import Header from "./Header";
import Footer from "./Footer";

export default function ConditionalHeader() {
  const pathname = usePathname();

  // Don't show header on admin login page
  if (pathname?.startsWith("/code-admin")) {
    return null;
  }

  // Don't show storefront header on OS / driver shells (they have their own chrome)
  if (
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/app") ||
    pathname?.startsWith("/driver") ||
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
      <Header />
    </Suspense>
  );
}

export function ConditionalFooter() {
  const pathname = usePathname();

  // Don't show footer on OS / driver shells or branded auth pages
  if (
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/app") ||
    pathname?.startsWith("/driver") ||
    pathname?.startsWith("/account") ||
    pathname?.startsWith("/sign-in") ||
    pathname?.startsWith("/sign-up") ||
    pathname?.startsWith("/sign-out")
  ) {
    return null;
  }

  return <Footer />;
}
