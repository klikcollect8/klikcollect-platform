import type { Permission } from "@/lib/authz/permissions";
import { isPermission } from "@/lib/authz/permissions";
import type { Actor, PermissionScope } from "@/lib/authz/actor";
import { permissionsForRole } from "@/lib/authz/roles";
import type { StaffMembershipRole } from "@/lib/authz/role-ids";
import { STORE_ROLES } from "@/lib/authz/role-ids";

function isStoreScopedRole(role: StaffMembershipRole): boolean {
  return (STORE_ROLES as readonly string[]).includes(role);
}

/**
 * Platform staff: permission from platform role set (already on actor.permissions).
 * Vendor-scoped: must hold permission via a membership that matches optional vendor/store.
 */
export function hasPermission(
  actor: Actor,
  permission: Permission | string,
  scope?: PermissionScope,
): boolean {
  if (!isPermission(permission)) return false;

  if (actor.isSuperAdmin) return true;

  if (actor.isPlatformStaff && actor.permissions.has(permission)) {
    // Platform oversight does not require vendor scope unless caller demands a vendorId
    // and actor has no platform-wide grant - platform staff already have the perm.
    return true;
  }

  if (!scope?.vendorId) {
    return actor.permissions.has(permission);
  }

  const memberships = actor.vendorMemberships.filter(
    (m) => m.vendorId === scope.vendorId && (m.status ?? "active") === "active",
  );

  for (const m of memberships) {
    if (scope.storeId && isStoreScopedRole(m.role)) {
      if (m.storeId && m.storeId !== scope.storeId) continue;
    }
    if (permissionsForRole(m.role).includes(permission)) {
      return true;
    }
  }

  // Platform staff with the permission may act across tenants for oversight.
  if (actor.isPlatformStaff && actor.permissions.has(permission)) {
    return true;
  }

  return false;
}

export function hasAnyPermission(
  actor: Actor,
  permissions: Permission[],
  scope?: PermissionScope,
): boolean {
  return permissions.some((p) => hasPermission(actor, p, scope));
}

export function hasAllPermissions(
  actor: Actor,
  permissions: Permission[],
  scope?: PermissionScope,
): boolean {
  return permissions.every((p) => hasPermission(actor, p, scope));
}

export class AuthzError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.name = "AuthzError";
    this.status = status;
  }
}

export function requirePermission(
  actor: Actor,
  permission: Permission,
  scope?: PermissionScope,
): void {
  if (!hasPermission(actor, permission, scope)) {
    throw new AuthzError(
      `Forbidden: missing permission '${permission}'` +
        (scope?.vendorId ? ` for vendor ${scope.vendorId}` : ""),
      403,
    );
  }
}
