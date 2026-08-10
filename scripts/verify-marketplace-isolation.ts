/**
 * Offline isolation / tenancy invariants for the connected marketplace.
 * Run: npx tsx scripts/verify-marketplace-isolation.ts
 */
import { resolveActor } from "../lib/authz/resolve-actor";
import { hasPermission } from "../lib/authz/can";
import { actorVendorIds, type Actor } from "../lib/authz/actor";
import { permissionsForRole } from "../lib/authz/roles";
import { applyConstitutionalFilter } from "../lib/authz/constitutional";
import type { User } from "@clerk/nextjs/server";

let failed = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed += 1;
  } else {
    console.log("ok:", msg);
  }
}

function fakeUser(partial: {
  id: string;
  email?: string;
  role?: string;
  vendorId?: string;
}): User {
  return {
    id: partial.id,
    primaryEmailAddress: partial.email
      ? { emailAddress: partial.email }
      : null,
    emailAddresses: partial.email
      ? [{ emailAddress: partial.email }]
      : [],
    publicMetadata: {
      ...(partial.role ? { role: partial.role } : {}),
      ...(partial.vendorId ? { vendorId: partial.vendorId } : {}),
    },
  } as unknown as User;
}

async function main() {
  const prevEnv = process.env.NODE_ENV;
  const prevSoft = process.env.RBAC_SOFT_OPEN_DEMO;
  const prevMeta = process.env.RBAC_ALLOW_METADATA_VENDOR;
  const prevFile = process.env.RBAC_FILE_MEMBERSHIPS;

  const env = process.env as Record<string, string | undefined>;
  env.NODE_ENV = "production";
  env.RBAC_SOFT_OPEN_DEMO = "true";
  env.RBAC_ALLOW_METADATA_VENDOR = "true";
  env.RBAC_FILE_MEMBERSHIPS = "true";

  const customer = await resolveActor(
    fakeUser({ id: "user_customer_1", email: "c@example.com" }),
  );
  assert(
    actorVendorIds(customer).length === 0,
    "production: customer gets no soft-open / metadata vendor memberships",
  );
  assert(
    !customer.isPlatformStaff,
    "production: customer is not platform staff",
  );

  const metaOnly = await resolveActor(
    fakeUser({
      id: "user_meta_1",
      email: "m@example.com",
      vendorId: "ven_other_vendor",
    }),
  );
  assert(
    actorVendorIds(metaOnly).length === 0,
    "production: publicMetadata.vendorId alone does not grant OS tenancy",
  );

  env.NODE_ENV = prevEnv || "development";
  env.RBAC_SOFT_OPEN_DEMO = prevSoft;
  env.RBAC_ALLOW_METADATA_VENDOR = prevMeta;
  env.RBAC_FILE_MEMBERSHIPS = prevFile;

  const vendorA: Actor = {
    userId: "user_a",
    email: "a@example.com",
    platformRole: null,
    vendorMemberships: [
      {
        vendorId: "ven_a",
        storeId: null,
        role: "vendor_owner",
        status: "active",
      },
    ],
    permissions: applyConstitutionalFilter(
      new Set(permissionsForRole("vendor_owner")),
      false,
    ),
    isSuperAdmin: false,
    isPlatformStaff: false,
  };

  assert(
    hasPermission(vendorA, "offers:price", { vendorId: "ven_a" }),
    "vendor A can price own offers",
  );
  assert(
    !hasPermission(vendorA, "offers:price", { vendorId: "ven_b" }),
    "vendor A cannot price vendor B offers",
  );
  assert(
    !hasPermission(vendorA, "finance:statements", { vendorId: "ven_b" }),
    "vendor A cannot read vendor B finance",
  );
  assert(
    !hasPermission(vendorA, "inventory:adjust", { vendorId: "ven_b" }),
    "vendor A cannot adjust vendor B inventory",
  );

  const driver: Actor = {
    userId: "user_drv",
    email: "d@example.com",
    platformRole: null,
    vendorMemberships: [
      {
        vendorId: "ven_a",
        storeId: null,
        role: "vendor_driver",
        status: "active",
      },
    ],
    permissions: applyConstitutionalFilter(
      new Set(permissionsForRole("vendor_driver")),
      false,
    ),
    isSuperAdmin: false,
    isPlatformStaff: false,
  };

  assert(
    hasPermission(driver, "delivery:view", { vendorId: "ven_a" }),
    "driver can view deliveries",
  );
  assert(
    !hasPermission(driver, "offers:price", { vendorId: "ven_a" }),
    "driver cannot price offers",
  );
  assert(
    !hasPermission(driver, "inventory:adjust", { vendorId: "ven_a" }),
    "driver cannot adjust inventory",
  );
  assert(
    !hasPermission(driver, "finance:withdraw", { vendorId: "ven_a" }),
    "driver cannot withdraw vendor balance",
  );

  if (failed) {
    console.error(`\n${failed} isolation check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll marketplace isolation checks passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
