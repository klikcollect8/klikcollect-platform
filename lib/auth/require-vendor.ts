import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { clerkEmail } from "@/lib/admin-auth";
import { unauthorizedJson, forbiddenJson } from "@/lib/auth/require-clerk-user";
import { resolveActor } from "@/lib/authz/resolve-actor";
import { actorVendorIds, type Actor } from "@/lib/authz/actor";
import { hasPermission, requirePermission, AuthzError } from "@/lib/authz/can";
import type { Permission } from "@/lib/authz/permissions";
import type { StaffMembershipRole } from "@/lib/authz/role-ids";

export type VendorActor = {
  userId: string;
  email: string | null;
  vendorIds: string[];
  /** Highest / primary membership role for UI convenience. */
  role: StaffMembershipRole | "platform_admin";
  isPlatformAdmin: boolean;
  actor: Actor;
};

function primaryVendorRole(
  actor: Actor,
): StaffMembershipRole | "platform_admin" {
  if (actor.isPlatformStaff) return "platform_admin";
  const order: StaffMembershipRole[] = [
    "vendor_owner",
    "vendor_admin",
    "store_manager",
    "finance_manager",
    "inventory_manager",
    "product_manager",
    "marketing_manager",
    "vendor_support",
    "vendor_staff",
    "fleet_manager",
    "dispatch_manager",
    "cashier",
    "sales_assistant",
    "stock_clerk",
    "vendor_driver",
    "warehouse_manager",
    "picker",
    "packer",
    "independent_driver",
  ];
  for (const role of order) {
    if (actor.vendorMemberships.some((m) => m.role === role)) return role;
  }
  return "vendor_staff";
}

/** Require Clerk session + vendor (or platform admin) access for OS mutations. */
export async function requireVendorActor(): Promise<
  { ok: true; actor: VendorActor } | { ok: false; response: NextResponse }
> {
  const user = await currentUser();
  if (!user) {
    return { ok: false, response: unauthorizedJson() };
  }

  const actor = await resolveActor(user);
  const vendorIds = actorVendorIds(actor);

  // OS APIs require a real staff_membership — platform staff use /api/admin/*
  if (!vendorIds.length) {
    return {
      ok: false,
      response: forbiddenJson("No vendor membership for this account"),
    };
  }

  return {
    ok: true,
    actor: {
      userId: user.id,
      email: clerkEmail(user),
      vendorIds,
      role: primaryVendorRole(actor),
      isPlatformAdmin: actor.isPlatformStaff,
      actor,
    },
  };
}

/** Require vendor actor + a specific permission (optional tenant scope). */
export async function requireVendorPermission(
  permission: Permission,
  scope?: { vendorId?: string; storeId?: string | null },
): Promise<
  { ok: true; actor: VendorActor } | { ok: false; response: NextResponse }
> {
  const gate = await requireVendorActor();
  if (!gate.ok) return gate;

  const vendorId = scope?.vendorId || gate.actor.vendorIds[0];
  if (
    vendorId &&
    !gate.actor.isPlatformAdmin &&
    !gate.actor.vendorIds.includes(vendorId)
  ) {
    return {
      ok: false,
      response: forbiddenJson("Vendor out of scope"),
    };
  }

  if (
    !hasPermission(gate.actor.actor, permission, {
      vendorId,
      storeId: scope?.storeId,
    })
  ) {
    return {
      ok: false,
      response: forbiddenJson(`Missing permission: ${permission}`),
    };
  }

  return gate;
}

export function assertVendorPermission(
  vendorActor: VendorActor,
  permission: Permission,
  scope?: { vendorId?: string; storeId?: string | null },
): void {
  try {
    requirePermission(vendorActor.actor, permission, scope);
  } catch (e) {
    if (e instanceof AuthzError) throw e;
    throw e;
  }
}
