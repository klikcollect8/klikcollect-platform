import { PERMISSIONS, type Permission } from "@/lib/authz/permissions";
import type {
  AnyRole,
  DeliveryRole,
  PlatformRole,
  StoreRole,
  VendorRole,
  WarehouseRole,
} from "@/lib/authz/role-ids";

function allPermissions(): Permission[] {
  return [...PERMISSIONS];
}

function except(
  base: readonly Permission[],
  deny: readonly Permission[],
): Permission[] {
  const denied = new Set<string>(deny);
  return base.filter((p) => !denied.has(p));
}

const PLATFORM_ADMIN_PERMS: Permission[] = [
  "auth:login",
  "auth:logout",
  "auth:mfa_manage",
  "users:view",
  "users:create",
  "users:suspend",
  "users:assign_roles",
  "vendors:view",
  "vendors:approve",
  "vendors:suspend",
  "vendors:verify",
  "vendors:manage",
  "staff:view",
  "staff:invite",
  "staff:assign_roles",
  "staff:revoke",
  "products:view",
  "products:approve",
  "products:reject",
  "products:feature",
  "categories:view",
  "categories:create",
  "categories:edit",
  "categories:manage",
  "brands:manage",
  "attributes:manage",
  "orders:view",
  "delivery:view",
  "delivery:track",
  "payments:view",
  "payments:providers",
  "payments:refund",
  "payments:payout",
  "ledger:view",
  "finance:settlements",
  "finance:tax_reports",
  "finance:statements",
  "analytics:view",
  "analytics:export",
  "reports:generate",
  "reports:export",
  "marketing:promotions",
  "cms:pages",
  "cms:banners",
  "cms:collections",
  "content:moderate",
  "flags:view",
  "system:configure",
  "system:health",
  "system:integrations",
  "audit:view",
  "audit:export",
  "security:sessions",
  "security:access_logs",
  "security:center",
  "compliance:kyc_review",
  "compliance:verify_identity",
  "compliance:disputes",
  "compliance:fraud_reports",
  "compliance:export",
  "compliance:suspend_accounts",
  "support:tickets_view",
  "support:tickets_create",
  "support:tickets_resolve",
  "support:escalate",
  "support:customers_view",
  "notifications:manage",
  "shipping:rules",
  "taxes:manage",
  "api:manage",
  "api:keys",
  "api:webhooks",
];

const COMPLIANCE_PERMS: Permission[] = [
  "auth:login",
  "auth:logout",
  "vendors:view",
  "vendors:verify",
  "vendors:suspend",
  "compliance:kyc_review",
  "compliance:verify_identity",
  "compliance:disputes",
  "compliance:fraud_reports",
  "compliance:export",
  "compliance:suspend_accounts",
  "payments:freeze_payouts",
  "audit:view",
  "audit:export",
  "support:customers_view",
  "reports:export",
];

const FINANCE_ADMIN_PERMS: Permission[] = [
  "auth:login",
  "auth:logout",
  "ledger:view",
  "ledger:reconcile",
  "finance:settlements",
  "finance:statements",
  "finance:tax_reports",
  "payments:view",
  "payments:providers",
  "payments:payout",
  "payments:payout_reverse",
  "payments:withdraw_approve",
  "payments:refund",
  "analytics:view",
  "reports:generate",
  "reports:export",
];

const SUPPORT_AGENT_PERMS: Permission[] = [
  "auth:login",
  "auth:logout",
  "support:customers_view",
  "support:tickets_view",
  "support:tickets_create",
  "support:tickets_resolve",
  "support:escalate",
  "orders:view",
  "vendors:view",
  "users:view",
  "content:moderate",
];

const CURATOR_PERMS: Permission[] = [
  "auth:login",
  "auth:logout",
  "products:view",
  "products:approve",
  "products:reject",
  "products:feature",
  "content:moderate",
  "categories:view",
  "categories:create",
  "categories:edit",
  "categories:manage",
  "cms:collections",
  "vendors:view",
];

const BI_ANALYST_PERMS: Permission[] = [
  "auth:login",
  "auth:logout",
  "analytics:view",
  "analytics:export",
  "reports:generate",
  "reports:export",
];

const SUPPORT_MANAGER_PERMS: Permission[] = [
  ...SUPPORT_AGENT_PERMS,
  "orders:refund",
  "users:suspend",
  "support:escalate",
];

const TRUST_SAFETY_PERMS: Permission[] = [
  "auth:login",
  "auth:logout",
  "compliance:fraud_reports",
  "compliance:suspend_accounts",
  "compliance:disputes",
  "content:moderate",
  "vendors:view",
  "vendors:suspend",
  "users:view",
  "users:suspend",
  "payments:freeze_payouts",
  "audit:view",
  "support:customers_view",
];

const CONTENT_MANAGER_PERMS: Permission[] = [
  "auth:login",
  "auth:logout",
  "cms:pages",
  "cms:banners",
  "cms:collections",
  "content:moderate",
  "products:view",
  "products:feature",
];

const PLATFORM_MARKETING_PERMS: Permission[] = [
  "auth:login",
  "auth:logout",
  "marketing:promotions",
  "marketing:coupons",
  "marketing:campaigns",
  "marketing:loyalty",
  "marketing:email",
  "marketing:sms",
  "cms:banners",
  "notifications:manage",
  "analytics:view",
];

const CUSTOMER_SUCCESS_PERMS: Permission[] = [
  "auth:login",
  "auth:logout",
  "support:customers_view",
  "support:tickets_view",
  "support:tickets_create",
  "support:tickets_resolve",
  "support:escalate",
  "vendors:view",
  "orders:view",
  "users:view",
  "analytics:view",
];

const DEVELOPER_PERMS: Permission[] = [
  "auth:login",
  "auth:logout",
  "flags:view",
  "flags:manage",
  "system:health",
  "system:integrations",
  "api:manage",
  "api:keys",
  "api:webhooks",
  "audit:view",
  "security:access_logs",
];

/**
 * Vendor storefront panel - own catalogue, stock, orders, team, payouts.
 * Platform abilities (approve vendors, CMS, flags, cross-tenant ledger) stay on platform roles.
 */
const VENDOR_OWNER_PERMS: Permission[] = [
  "auth:login",
  "auth:logout",
  "products:view",
  "products:create",
  "products:edit",
  "products:archive",
  "categories:view",
  "inventory:view",
  "inventory:receive",
  "inventory:adjust",
  "inventory:count",
  "inventory:transfer",
  "barcode:scan",
  "barcode:generate",
  "orders:view",
  "orders:cancel",
  "orders:fulfill",
  "orders:refund",
  "orders:return",
  "pos:open",
  "pos:close",
  "pos:sale",
  "pos:payment",
  "pos:print_receipt",
  "branches:view",
  "branches:create",
  "branches:edit",
  "branches:delete",
  "delivery:view",
  "delivery:assign",
  "delivery:reassign",
  "delivery:dispatch",
  "delivery:track",
  "delivery:pod",
  "staff:view",
  "staff:invite",
  "staff:assign_roles",
  "staff:revoke",
  "payments:view",
  "payments:payout",
  "ledger:view",
  "finance:withdraw",
  "finance:statements",
  "support:customers_view",
  "support:tickets_view",
  "support:tickets_create",
  "content:moderate",
  "notifications:manage",
  "vendor:transfer_ownership",
  "vendor:billing",
  "vendor:settings",
];

const VENDOR_ADMIN_PERMS: Permission[] = except(VENDOR_OWNER_PERMS, [
  "finance:withdraw",
  "vendor:transfer_ownership",
  "vendor:delete",
  "vendor:billing",
]);

const STORE_MANAGER_PERMS: Permission[] = [
  "auth:login",
  "auth:logout",
  "orders:view",
  "orders:create",
  "orders:fulfill",
  "orders:return",
  "orders:refund",
  "inventory:view",
  "inventory:receive",
  "inventory:count",
  "inventory:transfer",
  "barcode:scan",
  "pos:open",
  "pos:close",
  "pos:sale",
  "pos:payment",
  "pos:print_receipt",
  "staff:view",
  "staff:invite",
  "marketing:promotions",
  "reports:generate",
  "analytics:view",
  "support:customers_view",
  "content:moderate",
  "branches:view",
  "branches:edit",
];

/** Branch-scoped store ops (same ops surface; store_id expected on membership). */
const BRANCH_MANAGER_PERMS: Permission[] = [...STORE_MANAGER_PERMS];

const VENDOR_VIEWER_PERMS: Permission[] = [
  "auth:login",
  "auth:logout",
  "products:view",
  "categories:view",
  "inventory:view",
  "orders:view",
  "branches:view",
  "analytics:view",
  "reports:generate",
  "delivery:view",
  "payments:view",
  "staff:view",
];

const INVENTORY_MANAGER_PERMS: Permission[] = [
  "auth:login",
  "auth:logout",
  "inventory:view",
  "inventory:receive",
  "inventory:adjust",
  "inventory:transfer",
  "inventory:count",
  "inventory:reserve",
  "inventory:purchase_orders",
  "barcode:generate",
  "barcode:assign",
  "barcode:scan",
];

const PRODUCT_MANAGER_PERMS: Permission[] = [
  "auth:login",
  "auth:logout",
  "products:view",
  "products:create",
  "products:edit",
  "products:archive",
  "categories:view",
  "categories:edit",
  "attributes:manage",
  "content:moderate",
];

const FINANCE_MANAGER_PERMS: Permission[] = [
  "auth:login",
  "auth:logout",
  "ledger:view",
  "payments:view",
  "payments:payout",
  "payments:refund",
  "finance:withdraw",
  "finance:statements",
  "reports:generate",
  "reports:export",
];

const VENDOR_SUPPORT_PERMS: Permission[] = [
  "auth:login",
  "auth:logout",
  "support:customers_view",
  "orders:view",
  "support:tickets_view",
  "support:tickets_create",
  "support:tickets_resolve",
  "orders:refund",
  "content:moderate",
];

const MARKETING_MANAGER_PERMS: Permission[] = [
  "auth:login",
  "auth:logout",
  "marketing:promotions",
  "marketing:coupons",
  "marketing:campaigns",
  "marketing:loyalty",
  "marketing:email",
  "marketing:sms",
];

const CASHIER_PERMS: Permission[] = [
  "auth:login",
  "auth:logout",
  "pos:open",
  "pos:close",
  "pos:sale",
  "pos:payment",
  "pos:print_receipt",
  "orders:create",
  "orders:view",
  "barcode:scan",
  "products:view",
];

const SALES_ASSISTANT_PERMS: Permission[] = [
  "auth:login",
  "auth:logout",
  "orders:create",
  "orders:view",
  "products:view",
  "support:customers_view",
];

const STOCK_CLERK_PERMS: Permission[] = [
  "auth:login",
  "auth:logout",
  "inventory:view",
  "inventory:receive",
  "inventory:count",
  "barcode:scan",
];

const VENDOR_DRIVER_PERMS: Permission[] = [
  "auth:login",
  "auth:logout",
  "delivery:view",
  "delivery:complete",
  "delivery:pod",
  "delivery:otp",
  "delivery:track",
  "barcode:scan",
];

const FLEET_MANAGER_PERMS: Permission[] = [
  "auth:login",
  "auth:logout",
  "delivery:view",
  "delivery:assign",
  "delivery:track",
  "delivery:routes",
  "delivery:fleet_reports",
];

const DISPATCH_MANAGER_PERMS: Permission[] = [
  "auth:login",
  "auth:logout",
  "delivery:view",
  "delivery:assign",
  "delivery:reassign",
  "delivery:dispatch",
  "delivery:routes",
  "delivery:track",
];

const DELIVERY_AUDITOR_PERMS: Permission[] = [
  "auth:login",
  "auth:logout",
  "delivery:view",
  "delivery:track",
  "delivery:pod",
  "audit:view",
];

const WAREHOUSE_MANAGER_PERMS: Permission[] = [
  "auth:login",
  "auth:logout",
  "warehouse:inventory",
  "warehouse:transfers",
  "warehouse:receiving",
  "warehouse:picking",
  "warehouse:packing",
  "inventory:view",
  "inventory:transfer",
  "inventory:receive",
];

const PICKER_PERMS: Permission[] = [
  "auth:login",
  "auth:logout",
  "warehouse:picking",
  "barcode:scan",
  "products:view",
];

const PACKER_PERMS: Permission[] = [
  "auth:login",
  "auth:logout",
  "warehouse:packing",
  "warehouse:labels",
  "barcode:scan",
];

const WAREHOUSE_STAFF_PERMS: Permission[] = [
  "auth:login",
  "auth:logout",
  "warehouse:receiving",
  "warehouse:picking",
  "warehouse:packing",
  "warehouse:labels",
  "inventory:view",
  "inventory:receive",
  "inventory:count",
  "barcode:scan",
  "products:view",
];

/** Legacy vendor_staff ≈ limited vendor admin without finance/ownership. */
const VENDOR_STAFF_PERMS: Permission[] = except(VENDOR_ADMIN_PERMS, [
  "staff:invite",
  "staff:assign_roles",
  "staff:revoke",
  "branches:create",
  "branches:delete",
]);

export const PLATFORM_ROLE_PERMISSIONS: Record<PlatformRole, Permission[]> = {
  super_admin: allPermissions(),
  platform_admin: PLATFORM_ADMIN_PERMS,
  compliance_officer: COMPLIANCE_PERMS,
  finance_admin: FINANCE_ADMIN_PERMS,
  support_manager: SUPPORT_MANAGER_PERMS,
  support_agent: SUPPORT_AGENT_PERMS,
  trust_safety: TRUST_SAFETY_PERMS,
  marketplace_curator: CURATOR_PERMS,
  content_manager: CONTENT_MANAGER_PERMS,
  platform_marketing: PLATFORM_MARKETING_PERMS,
  customer_success: CUSTOMER_SUCCESS_PERMS,
  bi_analyst: BI_ANALYST_PERMS,
  developer: DEVELOPER_PERMS,
};

export const VENDOR_ROLE_PERMISSIONS: Record<VendorRole, Permission[]> = {
  vendor_owner: VENDOR_OWNER_PERMS,
  vendor_admin: VENDOR_ADMIN_PERMS,
  store_manager: STORE_MANAGER_PERMS,
  branch_manager: BRANCH_MANAGER_PERMS,
  inventory_manager: INVENTORY_MANAGER_PERMS,
  product_manager: PRODUCT_MANAGER_PERMS,
  finance_manager: FINANCE_MANAGER_PERMS,
  vendor_support: VENDOR_SUPPORT_PERMS,
  marketing_manager: MARKETING_MANAGER_PERMS,
  vendor_viewer: VENDOR_VIEWER_PERMS,
  vendor_staff: VENDOR_STAFF_PERMS,
};

export const STORE_ROLE_PERMISSIONS: Record<StoreRole, Permission[]> = {
  cashier: CASHIER_PERMS,
  sales_assistant: SALES_ASSISTANT_PERMS,
  stock_clerk: STOCK_CLERK_PERMS,
};

export const DELIVERY_ROLE_PERMISSIONS: Record<DeliveryRole, Permission[]> = {
  vendor_driver: VENDOR_DRIVER_PERMS,
  independent_driver: VENDOR_DRIVER_PERMS,
  fleet_manager: FLEET_MANAGER_PERMS,
  dispatch_manager: DISPATCH_MANAGER_PERMS,
  delivery_auditor: DELIVERY_AUDITOR_PERMS,
};

export const WAREHOUSE_ROLE_PERMISSIONS: Record<WarehouseRole, Permission[]> = {
  warehouse_manager: WAREHOUSE_MANAGER_PERMS,
  warehouse_staff: WAREHOUSE_STAFF_PERMS,
  picker: PICKER_PERMS,
  packer: PACKER_PERMS,
};

export function permissionsForRole(role: AnyRole): Permission[] {
  if (role in PLATFORM_ROLE_PERMISSIONS) {
    return PLATFORM_ROLE_PERMISSIONS[role as PlatformRole];
  }
  if (role in VENDOR_ROLE_PERMISSIONS) {
    return VENDOR_ROLE_PERMISSIONS[role as VendorRole];
  }
  if (role in STORE_ROLE_PERMISSIONS) {
    return STORE_ROLE_PERMISSIONS[role as StoreRole];
  }
  if (role in DELIVERY_ROLE_PERMISSIONS) {
    return DELIVERY_ROLE_PERMISSIONS[role as DeliveryRole];
  }
  if (role in WAREHOUSE_ROLE_PERMISSIONS) {
    return WAREHOUSE_ROLE_PERMISSIONS[role as WarehouseRole];
  }
  return [];
}

export function roleHasPermission(
  role: AnyRole,
  permission: Permission,
): boolean {
  return permissionsForRole(role).includes(permission);
}
