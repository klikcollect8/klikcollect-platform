/**
 * Assert RBAC matrix invariants (no network).
 * Run: npx tsx scripts/verify-rbac.ts
 */
import {
  CONSTITUTIONAL_DENIALS,
  applyConstitutionalFilter,
} from "../lib/authz/constitutional";
import { permissionsForRole, roleHasPermission } from "../lib/authz/roles";
import { PERMISSIONS } from "../lib/authz/permissions";
import {
  LEGACY_PLATFORM_ROLE_MAP,
  migrateLegacyPlatformRole,
} from "../lib/authz/role-ids";
import {
  canInviteRole,
  inviteableRolesForActor,
} from "../lib/authz/invite-ceiling";
import type { Actor } from "../lib/authz/actor";

let failed = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed += 1;
  } else {
    console.log("ok:", msg);
  }
}

// Legacy cutover
assert(
  migrateLegacyPlatformRole("head_admin") === "super_admin",
  "head_admin → super_admin",
);
assert(
  migrateLegacyPlatformRole("admin") === "platform_admin",
  "admin → platform_admin",
);
assert(
  migrateLegacyPlatformRole("editor") === "marketplace_curator",
  "editor → marketplace_curator",
);
assert(
  migrateLegacyPlatformRole("moderator") === "support_agent",
  "moderator → support_agent",
);
assert(
  Object.keys(LEGACY_PLATFORM_ROLE_MAP).includes("head_admin"),
  "legacy map includes head_admin",
);

// Super admin has everything
assert(
  permissionsForRole("super_admin").length === PERMISSIONS.length,
  "super_admin has all permissions",
);

// Constitutional: platform_admin stripped
const pa = applyConstitutionalFilter(
  permissionsForRole("platform_admin"),
  false,
);
for (const d of CONSTITUTIONAL_DENIALS) {
  assert(!pa.has(d), `platform_admin denied ${d}`);
}

const sa = applyConstitutionalFilter(
  permissionsForRole("super_admin"),
  true,
);
for (const d of CONSTITUTIONAL_DENIALS) {
  assert(sa.has(d), `super_admin retains ${d}`);
}

// Cashier cannot refund / adjust stock
assert(!roleHasPermission("cashier", "orders:refund"), "cashier ↛ refund");
assert(
  !roleHasPermission("cashier", "inventory:adjust"),
  "cashier ↛ inventory:adjust",
);
assert(roleHasPermission("cashier", "pos:sale"), "cashier → pos:sale");

// Vendor admin cannot withdraw / transfer ownership / delete business
assert(
  !roleHasPermission("vendor_admin", "finance:withdraw"),
  "vendor_admin ↛ withdraw",
);
assert(
  !roleHasPermission("vendor_admin", "vendor:transfer_ownership"),
  "vendor_admin ↛ transfer_ownership",
);
assert(
  !roleHasPermission("vendor_admin", "vendor:delete"),
  "vendor_admin ↛ delete",
);
assert(
  roleHasPermission("vendor_owner", "finance:withdraw"),
  "vendor_owner → withdraw",
);

// Product manager is offer helper — no canonical catalogue write
assert(
  !roleHasPermission("product_manager", "inventory:adjust"),
  "product_manager ↛ stock adjust",
);
assert(
  !roleHasPermission("product_manager", "products:edit"),
  "product_manager ↛ products:edit",
);
assert(
  !roleHasPermission("product_manager", "products:create"),
  "product_manager ↛ products:create",
);
assert(
  roleHasPermission("product_manager", "offers:price"),
  "product_manager → offers:price",
);
assert(
  roleHasPermission("product_manager", "catalogue:request_correction"),
  "product_manager → catalogue correction",
);

// BI analyst read-only analytics
assert(roleHasPermission("bi_analyst", "analytics:view"), "bi → analytics");
assert(
  !roleHasPermission("bi_analyst", "products:edit"),
  "bi ↛ products:edit",
);

// Support cannot withdraw
assert(
  !roleHasPermission("support_agent", "finance:withdraw"),
  "support ↛ withdraw",
);
assert(
  roleHasPermission("support_agent", "support:tickets_resolve"),
  "support → tickets",
);

// Compliance can freeze payouts, not edit products
assert(
  roleHasPermission("compliance_officer", "payments:freeze_payouts"),
  "compliance → freeze payouts",
);
assert(
  !roleHasPermission("compliance_officer", "products:edit"),
  "compliance ↛ products:edit",
);

// Driver cannot touch inventory/payments
assert(
  !roleHasPermission("vendor_driver", "inventory:adjust"),
  "driver ↛ inventory",
);
assert(
  !roleHasPermission("vendor_driver", "payments:payout"),
  "driver ↛ payments",
);
assert(
  roleHasPermission("vendor_driver", "delivery:complete"),
  "driver → delivery:complete",
);

// Finance manager: view/statements only — owner requests payouts
assert(
  !roleHasPermission("finance_manager", "finance:withdraw"),
  "finance_manager ↛ withdraw",
);
assert(
  roleHasPermission("finance_manager", "finance:statements"),
  "finance_manager → statements",
);
assert(
  !roleHasPermission("finance_manager", "products:edit"),
  "finance_manager ↛ products",
);
assert(
  !roleHasPermission("finance_manager", "products:create"),
  "finance_manager ↛ products:create",
);
assert(
  roleHasPermission("marketing_manager", "marketing:coupons"),
  "marketing → coupons",
);
assert(
  roleHasPermission("warehouse_manager", "warehouse:picking"),
  "warehouse_manager → picking",
);
assert(
  roleHasPermission("dispatch_manager", "delivery:reassign"),
  "dispatch → reassign",
);
assert(
  !roleHasPermission("dispatch_manager", "delivery:complete"),
  "dispatch ↛ scan/complete parcels",
);
assert(
  roleHasPermission("platform_admin", "vendors:manage"),
  "platform_admin → vendors",
);
assert(
  !roleHasPermission("platform_admin", "authz:bypass"),
  "platform_admin ↛ authz bypass (raw role set may include before filter)",
);

// Hierarchy gap-fill roles
assert(
  roleHasPermission("support_manager", "support:escalate"),
  "support_manager → escalate",
);
assert(
  roleHasPermission("support_manager", "orders:refund"),
  "support_manager → limited refund",
);
assert(
  !roleHasPermission("support_manager", "ledger:view"),
  "support_manager ↛ ledger",
);

assert(
  roleHasPermission("trust_safety", "payments:freeze_payouts"),
  "trust_safety → freeze payouts",
);
assert(
  !roleHasPermission("trust_safety", "products:edit"),
  "trust_safety ↛ products:edit",
);

assert(
  roleHasPermission("developer", "flags:manage"),
  "developer → flags",
);
assert(
  !roleHasPermission("developer", "ledger:view"),
  "developer ↛ ledger",
);
assert(
  !roleHasPermission("developer", "payments:payout"),
  "developer ↛ payout",
);

assert(
  roleHasPermission("vendor_viewer", "orders:view"),
  "vendor_viewer → orders:view",
);
assert(
  !roleHasPermission("vendor_viewer", "finance:withdraw"),
  "vendor_viewer ↛ withdraw",
);
assert(
  !roleHasPermission("vendor_viewer", "products:edit"),
  "vendor_viewer ↛ products:edit",
);

assert(
  roleHasPermission("delivery_auditor", "delivery:track"),
  "delivery_auditor → track",
);
assert(
  !roleHasPermission("delivery_auditor", "delivery:complete"),
  "delivery_auditor ↛ complete",
);
assert(
  !roleHasPermission("delivery_auditor", "delivery:assign"),
  "delivery_auditor ↛ assign",
);

assert(
  roleHasPermission("warehouse_staff", "warehouse:picking"),
  "warehouse_staff → picking",
);
assert(
  roleHasPermission("branch_manager", "pos:sale"),
  "branch_manager → pos",
);
assert(
  roleHasPermission("platform_marketing", "marketing:campaigns"),
  "platform_marketing → campaigns",
);
assert(
  roleHasPermission("content_manager", "cms:banners"),
  "content_manager → cms",
);
assert(
  roleHasPermission("customer_success", "vendors:view"),
  "customer_success → vendors:view",
);
assert(
  migrateLegacyPlatformRole("analytics_viewer") === "bi_analyst",
  "analytics_viewer → bi_analyst",
);

// Vendor storefront vs platform admin split
assert(
  !roleHasPermission("vendor_owner", "vendors:approve"),
  "vendor_owner ↛ vendors:approve",
);
assert(
  !roleHasPermission("vendor_owner", "flags:manage"),
  "vendor_owner ↛ flags",
);
assert(
  !roleHasPermission("vendor_owner", "cms:banners"),
  "vendor_owner ↛ cms",
);
assert(
  !roleHasPermission("vendor_owner", "cms:pages"),
  "vendor_owner ↛ cms:pages",
);
assert(
  !roleHasPermission("vendor_owner", "cms:collections"),
  "vendor_owner ↛ cms:collections",
);
assert(
  !roleHasPermission("vendor_owner", "flags:view"),
  "vendor_owner ↛ flags:view",
);
assert(
  roleHasPermission("vendor_owner", "delivery:dispatch"),
  "vendor_owner → delivery dispatch",
);
assert(
  roleHasPermission("vendor_owner", "pos:sale"),
  "vendor_owner → pos:sale",
);
assert(
  roleHasPermission("vendor_owner", "branches:view"),
  "vendor_owner → branches:view",
);
assert(
  !roleHasPermission("vendor_owner", "products:create"),
  "vendor_owner ↛ products:create (platform catalogue)",
);
assert(
  !roleHasPermission("vendor_owner", "products:edit"),
  "vendor_owner ↛ products:edit",
);
assert(
  roleHasPermission("vendor_owner", "offers:price"),
  "vendor_owner → offers:price",
);
assert(
  roleHasPermission("vendor_owner", "offers:view"),
  "vendor_owner → offers:view",
);
assert(
  roleHasPermission("vendor_owner", "catalogue:request_correction"),
  "vendor_owner → catalogue correction",
);
assert(
  roleHasPermission("vendor_admin", "offers:price"),
  "vendor_admin → offers:price",
);
assert(
  !roleHasPermission("store_manager", "offers:price"),
  "store_manager ↛ offers:price",
);
assert(
  roleHasPermission("platform_admin", "products:create"),
  "platform_admin → products:create",
);
assert(
  roleHasPermission("marketplace_curator", "products:edit"),
  "curator → products:edit",
);
assert(
  roleHasPermission("vendor_owner", "content:moderate"),
  "vendor_owner → content:moderate (Q&A/reviews)",
);
assert(
  roleHasPermission("vendor_support", "content:moderate"),
  "vendor_support → content:moderate",
);
assert(
  !roleHasPermission("cashier", "content:moderate"),
  "cashier ↛ content:moderate",
);
assert(
  roleHasPermission("vendor_owner", "offers:availability"),
  "vendor_owner → offers:availability",
);
assert(
  roleHasPermission("vendor_admin", "offers:availability"),
  "vendor_admin → offers:availability",
);

{
  const vid = "v_test";
  const ownerActor: Actor = {
    userId: "u_owner",
    email: "owner@test.com",
    platformRole: null,
    vendorMemberships: [
      { vendorId: vid, role: "vendor_owner", status: "active" },
    ],
    permissions: new Set(permissionsForRole("vendor_owner")),
    isSuperAdmin: false,
    isPlatformStaff: false,
  };
  const managerActor: Actor = {
    userId: "u_mgr",
    email: "mgr@test.com",
    platformRole: null,
    vendorMemberships: [
      { vendorId: vid, role: "store_manager", status: "active" },
    ],
    permissions: new Set(permissionsForRole("store_manager")),
    isSuperAdmin: false,
    isPlatformStaff: false,
  };
  assert(
    canInviteRole(ownerActor, vid, "store_manager"),
    "owner → invite store_manager",
  );
  assert(
    canInviteRole(ownerActor, vid, "vendor_owner"),
    "owner → invite vendor_owner",
  );
  assert(
    inviteableRolesForActor(ownerActor, vid).includes("vendor_admin"),
    "owner inviteable includes vendor_admin",
  );
  assert(
    !canInviteRole(managerActor, vid, "vendor_owner"),
    "store_manager ↛ invite vendor_owner",
  );
  assert(
    !canInviteRole(managerActor, vid, "vendor_admin"),
    "store_manager ↛ invite vendor_admin",
  );
}
assert(
  roleHasPermission("platform_admin", "vendors:approve"),
  "platform_admin → vendors:approve",
);
assert(
  roleHasPermission("platform_admin", "cms:banners"),
  "platform_admin → cms",
);
assert(
  roleHasPermission("platform_admin", "payments:providers"),
  "platform_admin → payments:providers",
);
assert(
  roleHasPermission("finance_admin", "payments:providers"),
  "finance_admin → payments:providers",
);
assert(
  roleHasPermission("finance_admin", "payments:view"),
  "finance_admin → payments:view",
);

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll RBAC invariants passed.");
