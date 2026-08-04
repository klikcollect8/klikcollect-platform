/** All RBAC role identifiers (platform / vendor / store / delivery / warehouse). */

export const PLATFORM_ROLES = [
  "super_admin",
  "platform_admin",
  "compliance_officer",
  "finance_admin",
  "support_manager",
  "support_agent",
  "trust_safety",
  "marketplace_curator",
  "content_manager",
  "platform_marketing",
  "customer_success",
  "bi_analyst",
  "developer",
] as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const VENDOR_ROLES = [
  "vendor_owner",
  "vendor_admin",
  "store_manager",
  "branch_manager",
  "inventory_manager",
  "product_manager",
  "finance_manager",
  "vendor_support",
  "marketing_manager",
  "vendor_viewer",
  /** Legacy fallback until staff are reassigned. */
  "vendor_staff",
] as const;

export type VendorRole = (typeof VENDOR_ROLES)[number];

export const STORE_ROLES = [
  "cashier",
  "sales_assistant",
  "stock_clerk",
] as const;

export type StoreRole = (typeof STORE_ROLES)[number];

export const DELIVERY_ROLES = [
  "vendor_driver",
  "independent_driver",
  "fleet_manager",
  "dispatch_manager",
  "delivery_auditor",
] as const;

export type DeliveryRole = (typeof DELIVERY_ROLES)[number];

export const WAREHOUSE_ROLES = [
  "warehouse_manager",
  "warehouse_staff",
  "picker",
  "packer",
] as const;

export type WarehouseRole = (typeof WAREHOUSE_ROLES)[number];

/** Roles that may appear on staff_memberships (vendor-scoped, optional store_id). */
export const STAFF_MEMBERSHIP_ROLES = [
  ...VENDOR_ROLES,
  ...STORE_ROLES,
  ...DELIVERY_ROLES,
  ...WAREHOUSE_ROLES,
] as const;

export type StaffMembershipRole = (typeof STAFF_MEMBERSHIP_ROLES)[number];

/**
 * Base inviteable roles (always on). Plane roles unlock via control-panel flags.
 * Matrices for store/delivery/warehouse remain so existing memberships authorize.
 */
export const ENABLED_STAFF_ROLES = [...VENDOR_ROLES] as const;

export type EnabledStaffRole = (typeof ENABLED_STAFF_ROLES)[number];

/** Inviteable roles given feature flags (store_ops / couriers / warehouse). */
export function inviteableStaffRoles(flags: {
  store_ops?: boolean;
  couriers?: boolean;
  warehouse?: boolean;
}): readonly StaffMembershipRole[] {
  const roles: StaffMembershipRole[] = [...VENDOR_ROLES];
  if (flags.store_ops) roles.push(...STORE_ROLES);
  if (flags.couriers) roles.push(...DELIVERY_ROLES);
  if (flags.warehouse) roles.push(...WAREHOUSE_ROLES);
  return roles;
}

export function isInviteableStaffRole(
  role: string,
  flags: { store_ops?: boolean; couriers?: boolean; warehouse?: boolean },
): role is StaffMembershipRole {
  return (inviteableStaffRoles(flags) as readonly string[]).includes(role);
}

export type AnyRole =
  | PlatformRole
  | VendorRole
  | StoreRole
  | DeliveryRole
  | WarehouseRole;

export function isPlatformRole(role: string): role is PlatformRole {
  return (PLATFORM_ROLES as readonly string[]).includes(role);
}

export function isStaffMembershipRole(
  role: string,
): role is StaffMembershipRole {
  return (STAFF_MEMBERSHIP_ROLES as readonly string[]).includes(role);
}

export function isEnabledStaffRole(role: string): role is EnabledStaffRole {
  return (ENABLED_STAFF_ROLES as readonly string[]).includes(role);
}

/** Legacy Clerk / profiles role → new platform role. */
export const LEGACY_PLATFORM_ROLE_MAP: Record<string, PlatformRole> = {
  head_admin: "super_admin",
  admin: "platform_admin",
  editor: "marketplace_curator",
  moderator: "support_agent",
  analytics_viewer: "bi_analyst",
  super_admin: "super_admin",
  platform_admin: "platform_admin",
  compliance_officer: "compliance_officer",
  finance_admin: "finance_admin",
  support_manager: "support_manager",
  support_agent: "support_agent",
  trust_safety: "trust_safety",
  marketplace_curator: "marketplace_curator",
  content_manager: "content_manager",
  platform_marketing: "platform_marketing",
  customer_success: "customer_success",
  bi_analyst: "bi_analyst",
  developer: "developer",
};

export function migrateLegacyPlatformRole(
  role: string | null | undefined,
): PlatformRole | null {
  if (!role) return null;
  const key = role.trim().toLowerCase();
  return LEGACY_PLATFORM_ROLE_MAP[key] ?? null;
}

export const PLATFORM_ROLE_LABELS: Record<PlatformRole, string> = {
  super_admin: "Super Admin",
  platform_admin: "Platform Admin",
  compliance_officer: "Compliance Officer",
  finance_admin: "Finance Admin",
  support_manager: "Support Manager",
  support_agent: "Support Agent",
  trust_safety: "Trust & Safety",
  marketplace_curator: "Marketplace Curator",
  content_manager: "Content Manager",
  platform_marketing: "Marketing Manager",
  customer_success: "Customer Success",
  bi_analyst: "Analytics Viewer",
  developer: "Developer",
};

export const STAFF_ROLE_LABELS: Record<StaffMembershipRole, string> = {
  vendor_owner: "Vendor Owner",
  vendor_admin: "Vendor Admin",
  store_manager: "Store Manager",
  branch_manager: "Branch Manager",
  inventory_manager: "Inventory Manager",
  product_manager: "Product Manager",
  finance_manager: "Finance Staff",
  vendor_support: "Customer Service",
  marketing_manager: "Marketing Staff",
  vendor_viewer: "Viewer",
  vendor_staff: "Vendor Staff",
  cashier: "Cashier",
  sales_assistant: "Sales Assistant",
  stock_clerk: "Stock Clerk",
  vendor_driver: "Vendor Driver",
  independent_driver: "Independent Driver",
  fleet_manager: "Fleet Manager",
  dispatch_manager: "Dispatch Manager",
  delivery_auditor: "Delivery Auditor",
  warehouse_manager: "Warehouse Manager",
  warehouse_staff: "Warehouse Staff",
  picker: "Picker",
  packer: "Packer",
};
