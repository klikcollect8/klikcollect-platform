import type { User } from "@clerk/nextjs/server";
import { clerkEmail } from "@/lib/auth/clerk-email";
import type { Actor, VendorMembershipScope } from "@/lib/authz/actor";
import { applyConstitutionalFilter } from "@/lib/authz/constitutional";
import type { Permission } from "@/lib/authz/permissions";
import {
  isPlatformRole,
  migrateLegacyPlatformRole,
  type PlatformRole,
  type StaffMembershipRole,
  isStaffMembershipRole,
} from "@/lib/authz/role-ids";
import { permissionsForRole } from "@/lib/authz/roles";
import {
  listPlatformMembership,
  listStaffMembershipsForClerkUser,
} from "@/lib/authz/memberships";
import { DEMO_VENDOR_ID } from "@/lib/tenancy";
import { getAdmittedVendors } from "@/lib/admitted-vendors";

function platformAdminEmails(): string[] {
  return (process.env.PLATFORM_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function softOpenDemoVendor(): boolean {
  if (process.env.RBAC_SOFT_OPEN_DEMO === "true") return true;
  if (process.env.RBAC_SOFT_OPEN_DEMO === "false") return false;
  return process.env.NODE_ENV !== "production";
}

function shouldUseFileMembershipFallback(): boolean {
  return process.env.RBAC_FILE_MEMBERSHIPS === "true";
}

async function resolvePlatformRole(user: User): Promise<PlatformRole | null> {
  // 1. Postgres platform_memberships
  try {
    const row = await listPlatformMembership(user.id);
    if (row && isPlatformRole(row.role)) return row.role;
  } catch {
    // DB may be unavailable in local M1 - fall through
  }

  // 2. Clerk publicMetadata.role (with legacy cutover)
  const meta = user.publicMetadata?.role;
  if (typeof meta === "string") {
    const migrated = migrateLegacyPlatformRole(meta);
    if (migrated) {
      try {
        const { upsertPlatformMembership } = await import(
          "@/lib/authz/memberships"
        );
        await upsertPlatformMembership({
          clerkUserId: user.id,
          email: clerkEmail(user),
          role: migrated,
          status: "active",
        });
      } catch {
        /* ignore */
      }
      return migrated;
    }
  }

  // 3. Email allowlist → super_admin (seed membership)
  const email = clerkEmail(user);
  if (email && platformAdminEmails().includes(email)) {
    try {
      const { upsertPlatformMembership } = await import(
        "@/lib/authz/memberships"
      );
      await upsertPlatformMembership({
        clerkUserId: user.id,
        email,
        role: "super_admin",
        status: "active",
      });
    } catch {
      /* ignore */
    }
    return "super_admin";
  }

  return null;
}

async function loadVendorMemberships(
  user: User,
): Promise<VendorMembershipScope[]> {
  const email = clerkEmail(user);

  try {
    const rows = await listStaffMembershipsForClerkUser(user.id, email);
    if (rows.length) {
      return rows
        .filter((r) => r.status === "active" && isStaffMembershipRole(r.role))
        .map((r) => ({
          vendorId: r.vendorId,
          storeId: r.storeId,
          role: r.role as StaffMembershipRole,
          status: r.status,
        }));
    }
  } catch {
    // fall through
  }

  if (shouldUseFileMembershipFallback()) {
    const { listMembershipsForUser } = await import("@/lib/vendor-membership");
    const fileRows = await listMembershipsForUser(user);
    return fileRows.map((r) => ({
      vendorId: r.vendorId,
      storeId: null,
      role: (isStaffMembershipRole(r.role)
        ? r.role
        : "vendor_staff") as StaffMembershipRole,
      status: "active" as const,
    }));
  }

  // Clerk metadata shortcut
  const metaVendorId =
    typeof user.publicMetadata?.vendorId === "string"
      ? user.publicMetadata.vendorId.trim()
      : null;
  const metaRoleRaw = user.publicMetadata?.vendorRole;
  const metaRole =
    typeof metaRoleRaw === "string" && isStaffMembershipRole(metaRoleRaw)
      ? metaRoleRaw
      : metaVendorId
        ? ("vendor_owner" as StaffMembershipRole)
        : null;
  if (metaVendorId && metaRole) {
    return [
      {
        vendorId: metaVendorId,
        storeId: null,
        role: metaRole,
        status: "active",
      },
    ];
  }

  if (softOpenDemoVendor()) {
    return [
      {
        vendorId: DEMO_VENDOR_ID,
        storeId: null,
        role: "vendor_staff",
        status: "active",
      },
    ];
  }

  return [];
}

function mergePermissions(
  platformRole: PlatformRole | null,
  memberships: VendorMembershipScope[],
): Set<Permission> {
  const perms = new Set<Permission>();
  if (platformRole) {
    for (const p of permissionsForRole(platformRole)) perms.add(p);
  }
  for (const m of memberships) {
    if ((m.status ?? "active") !== "active") continue;
    for (const p of permissionsForRole(m.role)) perms.add(p);
  }
  return applyConstitutionalFilter(perms, platformRole === "super_admin");
}

/**
 * Resolve the full Actor for a Clerk user.
 * Clerk authenticates; this authorizes.
 */
export async function resolveActor(user: User): Promise<Actor> {
  const platformRole = await resolvePlatformRole(user);
  const vendorMemberships = await loadVendorMemberships(user);

  // Platform staff get oversight across admitted vendors + demo (no inventory edit
  // unless their platform role grants the relevant permission).
  if (platformRole) {
    try {
      const admitted = await getAdmittedVendors();
      const oversightIds = [DEMO_VENDOR_ID, ...admitted.map((v) => v.id)];
      const existing = new Set(vendorMemberships.map((m) => m.vendorId));
      for (const vendorId of oversightIds) {
        if (!existing.has(vendorId)) {
          vendorMemberships.push({
            vendorId,
            storeId: null,
            role: "vendor_staff",
            status: "active",
          });
        }
      }
    } catch {
      // ignore admitted-vendor failures
    }
  }

  const isSuperAdmin = platformRole === "super_admin";
  const permissions = mergePermissions(platformRole, vendorMemberships);

  return {
    userId: user.id,
    email: clerkEmail(user),
    platformRole,
    vendorMemberships,
    permissions,
    isSuperAdmin,
    isPlatformStaff: !!platformRole,
  };
}
