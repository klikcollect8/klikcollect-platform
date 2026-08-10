/**
 * Vendor staff invite ceiling — inviters cannot assign roles above their authority.
 */
import type { Actor } from "@/lib/authz/actor";
import { membershipsForVendor } from "@/lib/authz/actor";
import { permissionsForRole } from "@/lib/authz/roles";
import {
  MVP_VENDOR_INVITE_ROLES,
  type StaffMembershipRole,
} from "@/lib/authz/role-ids";
import type { Permission } from "@/lib/authz/permissions";

/** Lower number = higher authority. */
const ROLE_RANK: Record<string, number> = {
  vendor_owner: 100,
  vendor_admin: 80,
  store_manager: 60,
  branch_manager: 60,
  inventory_manager: 55,
  finance_manager: 55,
  product_manager: 55,
  dispatch_manager: 50,
  marketing_manager: 45,
  vendor_support: 45,
  vendor_staff: 40,
  vendor_viewer: 30,
  cashier: 25,
  sales_assistant: 25,
  stock_clerk: 25,
  fleet_manager: 40,
  vendor_driver: 20,
  independent_driver: 20,
  delivery_auditor: 35,
  warehouse_manager: 50,
  warehouse_staff: 30,
  picker: 20,
  packer: 20,
};

export function roleRank(role: string): number {
  return ROLE_RANK[role] ?? 0;
}

function inviterPermsForVendor(
  actor: Actor,
  vendorId: string,
): Set<Permission> {
  if (actor.isPlatformStaff || actor.isSuperAdmin) {
    return new Set(actor.permissions);
  }
  const memberships = membershipsForVendor(actor, vendorId).filter(
    (m) => (m.status ?? "active") === "active",
  );
  const perms = new Set<Permission>();
  for (const m of memberships) {
    for (const p of permissionsForRole(m.role)) perms.add(p);
  }
  return perms;
}

function highestInviterRank(actor: Actor, vendorId: string): number {
  if (actor.isPlatformStaff || actor.isSuperAdmin) return 999;
  const memberships = membershipsForVendor(actor, vendorId).filter(
    (m) => (m.status ?? "active") === "active",
  );
  let best = 0;
  for (const m of memberships) best = Math.max(best, roleRank(m.role));
  return best;
}

function isPermissionSubset(
  required: readonly Permission[],
  held: Set<Permission>,
): boolean {
  return required.every((p) => held.has(p));
}

/** Roles this actor may invite for the given vendor. */
export function inviteableRolesForActor(
  actor: Actor,
  vendorId: string,
): StaffMembershipRole[] {
  const held = inviterPermsForVendor(actor, vendorId);
  const inviterRank = highestInviterRank(actor, vendorId);
  const canInviteOwner =
    actor.isPlatformStaff ||
    actor.isSuperAdmin ||
    membershipsForVendor(actor, vendorId).some(
      (m) =>
        m.role === "vendor_owner" && (m.status ?? "active") === "active",
    );

  // Owner/admin: rank ceiling is enough (their perms are not a strict
  // superset of every store role). Lower roles: permission subset + rank.
  const rankAuthority = inviterRank >= (ROLE_RANK.vendor_admin ?? 80);

  const out: StaffMembershipRole[] = [];
  for (const role of MVP_VENDOR_INVITE_ROLES) {
    if (role === "vendor_owner" && !canInviteOwner) continue;
    if (roleRank(role) > inviterRank) continue;
    if (
      !rankAuthority &&
      !isPermissionSubset(permissionsForRole(role), held)
    ) {
      continue;
    }
    out.push(role);
  }
  return out;
}

export function canInviteRole(
  actor: Actor,
  vendorId: string,
  role: string,
): boolean {
  return inviteableRolesForActor(actor, vendorId).includes(
    role as StaffMembershipRole,
  );
}
