"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUserAuth } from "@/lib/hooks/useUserAuth";

/**
 * Component that checks if user is banned/disabled and redirects to restricted page
 * Should be placed in the root layout to check on all pages
 */
export default function AccountRestrictionCheck() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, userStatus } = useUserAuth();

  useEffect(() => {
    // Don't redirect if still loading or on restricted page or sign-in pages
    if (
      loading ||
      pathname === "/account-restricted" ||
      pathname === "/sign-in" ||
      pathname === "/sign-up"
    ) {
      return;
    }

    // If user is signed in and has restricted status, redirect to restricted page
    if (user && (userStatus === "disabled" || userStatus === "banned")) {
      router.push("/account-restricted");
    }
  }, [user, userStatus, loading, pathname, router]);

  return null;
}
