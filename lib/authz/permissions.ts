/**
 * Domain-prefixed permission catalog for KlikCollect RBAC.
 * Customers and guests have no entries here - ownership-based only.
 */

export const PERMISSIONS = [
  // Authentication / sessions (staff surfaces)
  "auth:login",
  "auth:logout",
  "auth:mfa_manage",

  // User management (platform)
  "users:view",
  "users:create",
  "users:suspend",
  "users:delete",
  "users:assign_roles",

  // Vendor management (platform)
  "vendors:view",
  "vendors:approve",
  "vendors:suspend",
  "vendors:verify",
  "vendors:manage",
  "vendors:delete",

  // Branch / store
  "branches:view",
  "branches:create",
  "branches:edit",
  "branches:delete",

  // Staff management
  "staff:view",
  "staff:invite",
  "staff:assign_roles",
  "staff:revoke",

  // Products (canonical catalogue — platform only for create/edit)
  "products:view",
  "products:create",
  "products:edit",
  "products:archive",
  "products:approve",
  "products:reject",
  "products:feature",

  // Vendor offers (price / availability on platform-owned products)
  "offers:view",
  "offers:price",
  "offers:availability",
  "catalogue:request_correction",

  // Categories / attributes / brands
  "categories:view",
  "categories:create",
  "categories:edit",
  "categories:manage",
  "brands:manage",
  "attributes:manage",

  // Inventory
  "inventory:view",
  "inventory:receive",
  "inventory:adjust",
  "inventory:transfer",
  "inventory:count",
  "inventory:reserve",
  "inventory:purchase_orders",

  // Barcode
  "barcode:generate",
  "barcode:assign",
  "barcode:scan",

  // Orders
  "orders:view",
  "orders:create",
  "orders:cancel",
  "orders:fulfill",
  "orders:refund",
  "orders:return",

  // POS
  "pos:open",
  "pos:close",
  "pos:sale",
  "pos:payment",
  "pos:print_receipt",

  // Delivery
  "delivery:view",
  "delivery:assign",
  "delivery:reassign",
  "delivery:dispatch",
  "delivery:complete",
  "delivery:track",
  "delivery:pod",
  "delivery:otp",
  "delivery:routes",
  "delivery:fleet_reports",

  // Payments
  "payments:view",
  "payments:capture",
  "payments:refund",
  "payments:payout",
  "payments:payout_reverse",
  "payments:withdraw_approve",
  "payments:freeze_payouts",
  "payments:providers",

  // Ledger / finance
  "ledger:view",
  "ledger:reconcile",
  "ledger:delete_immutable",
  "ledger:bypass",
  "finance:withdraw",
  "finance:statements",
  "finance:tax_reports",
  "finance:settlements",

  // Analytics / reports
  "analytics:view",
  "analytics:export",
  "reports:generate",
  "reports:export",

  // Marketing
  "marketing:promotions",
  "marketing:coupons",
  "marketing:campaigns",
  "marketing:loyalty",
  "marketing:email",
  "marketing:sms",

  // CMS / content
  "cms:pages",
  "cms:banners",
  "cms:collections",
  "content:moderate",

  // Feature flags / system
  "flags:view",
  "flags:manage",
  "system:configure",
  "system:health",
  "system:integrations",
  "system:disaster_recovery",
  "system:database",

  // API
  "api:keys",
  "api:webhooks",
  "api:manage",

  // Audit / security
  "audit:view",
  "audit:export",
  "audit:modify_history",
  "security:sessions",
  "security:access_logs",
  "security:center",
  "authz:bypass",

  // Compliance
  "compliance:kyc_review",
  "compliance:verify_identity",
  "compliance:disputes",
  "compliance:fraud_reports",
  "compliance:export",
  "compliance:suspend_accounts",

  // Support
  "support:tickets_view",
  "support:tickets_create",
  "support:tickets_resolve",
  "support:escalate",
  "support:customers_view",

  // Notifications
  "notifications:email",
  "notifications:sms",
  "notifications:push",
  "notifications:manage",

  // Shipping / taxes (platform)
  "shipping:rules",
  "taxes:manage",

  // Warehouse (V2)
  "warehouse:inventory",
  "warehouse:transfers",
  "warehouse:receiving",
  "warehouse:picking",
  "warehouse:packing",
  "warehouse:labels",

  // Vendor ownership
  "vendor:transfer_ownership",
  "vendor:delete",
  "vendor:billing",
  "vendor:settings",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

/** Permission domains for documentation and grouping. */
export const PERMISSION_DOMAINS = [
  "auth",
  "users",
  "vendors",
  "branches",
  "staff",
  "products",
  "offers",
  "catalogue",
  "categories",
  "inventory",
  "barcode",
  "orders",
  "pos",
  "delivery",
  "payments",
  "ledger",
  "finance",
  "analytics",
  "reports",
  "marketing",
  "cms",
  "content",
  "flags",
  "system",
  "api",
  "audit",
  "security",
  "authz",
  "compliance",
  "support",
  "notifications",
  "shipping",
  "taxes",
  "warehouse",
  "vendor",
  "brands",
  "attributes",
] as const;
