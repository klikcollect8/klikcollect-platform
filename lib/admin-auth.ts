import { currentUser, type User } from "@clerk/nextjs/server";

export const ADMIN_ROLES = ["head_admin", "admin", "editor", "moderator"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

function platformAdminEmails(): string[] {
  return (process.env.PLATFORM_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminRole(role: string | null | undefined): role is AdminRole {
  if (!role) return false;
  return (ADMIN_ROLES as readonly string[]).includes(role.trim().toLowerCase());
}

export function clerkEmail(user: User): string | null {
  return (
    user.primaryEmailAddress?.emailAddress?.toLowerCase() ||
    user.emailAddresses[0]?.emailAddress?.toLowerCase() ||
    null
  );
}

/**
 * Clerk authenticates; KlikCollect authorizes.
 * Order: publicMetadata.role → PLATFORM_ADMIN_EMAILS allowlist.
 */
export async function resolveAdminRole(user: User): Promise<AdminRole | null> {
  const meta = user.publicMetadata?.role;
  if (typeof meta === "string" && isAdminRole(meta)) {
    return meta.trim().toLowerCase() as AdminRole;
  }

  const email = clerkEmail(user);
  if (email && platformAdminEmails().includes(email)) {
    return "head_admin";
  }

  // Skip slow Supabase profiles lookup — profiles table may be missing and
  // hanging auth resolution was causing 500s across admin APIs.
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
