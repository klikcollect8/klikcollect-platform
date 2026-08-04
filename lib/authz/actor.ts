import type { Permission } from "@/lib/authz/permissions";
import type { PlatformRole, StaffMembershipRole } from "@/lib/authz/role-ids";

export type VendorMembershipScope = {
  vendorId: string;
  storeId?: string | null;
  role: StaffMembershipRole;
  status?: "active" | "invited" | "revoked";
};

export type Actor = {
  userId: string;
  email: string | null;
  platformRole: PlatformRole | null;
  vendorMemberships: VendorMembershipScope[];
  /** Resolved permissions after constitutional filter. */
  permissions: Set<Permission>;
  isSuperAdmin: boolean;
  isPlatformStaff: boolean;
};

export type PermissionScope = {
  vendorId?: string;
  storeId?: string | null;
};

export function actorVendorIds(actor: Actor): string[] {
  return [...new Set(actor.vendorMemberships.map((m) => m.vendorId))];
}

export function membershipsForVendor(
  actor: Actor,
  vendorId: string,
): VendorMembershipScope[] {
  return actor.vendorMemberships.filter((m) => m.vendorId === vendorId);
}
