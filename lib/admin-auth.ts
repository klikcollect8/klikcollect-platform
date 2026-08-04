import { currentUser, type User } from "@clerk/nextjs/server";
import {
  PLATFORM_ROLES,
  migrateLegacyPlatformRole,
  type PlatformRole,
} from "@/lib/authz/role-ids";
import { resolveActor } from "@/lib/authz/resolve-actor";
import { clerkEmail } from "@/lib/auth/clerk-email";

export { clerkEmail };

/** @deprecated Prefer PLATFORM_ROLES / PlatformRole from lib/authz */
export const ADMIN_ROLES = PLATFORM_ROLES;
export type AdminRole = PlatformRole;

function platformAdminEmails(): string[] {
  return (process.env.PLATFORM_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminRole(
  role: string | null | undefined,
): role is AdminRole {
  if (!role) return false;
  return migrateLegacyPlatformRole(role) !== null;
}

/**
 * Clerk authenticates; KlikCollect authorizes.
 * Order: platform_memberships → publicMetadata.role (legacy map) → PLATFORM_ADMIN_EMAILS.
 */
export async function resolveAdminRole(user: User): Promise<AdminRole | null> {
  const actor = await resolveActor(user);
  if (actor.platformRole) return actor.platformRole;

  // Fast path when actor resolution skipped meta (should not happen)
  const meta = user.publicMetadata?.role;
  if (typeof meta === "string") {
    const migrated = migrateLegacyPlatformRole(meta);
    if (migrated) return migrated;
  }

  const email = clerkEmail(user);
  if (email && platformAdminEmails().includes(email)) {
    return "super_admin";
  }

  return null;
}

export async function requireAdminUser(): Promise<{
  user: User;
  role: AdminRole;
  email: string | null;
} | null> {
  const user = await currentUser();
  if (!user) return null;
  const role = await resolveAdminRole(user);
  if (!role) return null;
  return { user, role, email: clerkEmail(user) };
}
