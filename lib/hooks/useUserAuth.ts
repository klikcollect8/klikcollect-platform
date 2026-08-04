"use client";

import { useUser } from "@clerk/nextjs";
import { useMemo } from "react";

export type MarketplaceUser = {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  imageUrl?: string;
};

/**
 * Marketplace auth - Clerk only (Founder D2).
 * Admins and customers share the same identity plane; authorization is separate.
 */
export function useUserAuth() {
  const { user, isLoaded, isSignedIn } = useUser();

  const mapped: MarketplaceUser | null = useMemo(() => {
    if (!user) return null;
    return {
      id: user.id,
      email:
        user.primaryEmailAddress?.emailAddress ||
        user.emailAddresses[0]?.emailAddress,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      imageUrl: user.imageUrl,
    };
  }, [user]);

  const userRole =
    typeof user?.publicMetadata?.role === "string"
      ? String(user.publicMetadata.role)
      : null;

  const statusMeta = user?.publicMetadata?.status;
  const userStatus: "active" | "disabled" | "banned" | null = !mapped
    ? null
    : statusMeta === "disabled" || statusMeta === "banned"
      ? statusMeta
      : "active";

  return {
    user: mapped,
    loading: !isLoaded,
    isSignedIn: !!isSignedIn && !!mapped,
    userStatus,
    userRole,
  };
}
