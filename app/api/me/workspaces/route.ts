import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { resolveActor } from "@/lib/authz/resolve-actor";
import { actorVendorIds } from "@/lib/authz/actor";
import {
  PLATFORM_ROLE_LABELS,
  type PlatformRole,
} from "@/lib/authz/role-ids";
import { resolveRoleChrome } from "@/lib/workspace/role-chrome";

/**
 * Soft workspace discovery for storefront nav/banners.
 * Never 403s — unsigned or non-staff simply get empty access flags.
 */
export async function GET() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({
      data: {
        signedIn: false,
        vendor: false,
        admin: false,
        vendorIds: [] as string[],
        roleLabel: null as string | null,
        platformRoleLabel: null as string | null,
        primaryRoleId: null as string | null,
        platformRoleId: null as string | null,
        chromePlane: null as string | null,
      },
    });
  }

  const actor = await resolveActor(user);
  const vendorIds = actorVendorIds(actor);
  const membershipRole = actor.vendorMemberships[0]?.role || null;
  const platformRole = actor.platformRole;
  const admin = actor.isPlatformStaff;
  const vendor = vendorIds.length > 0;
  const chrome = resolveRoleChrome({
    staffRole: membershipRole,
    platformRole,
    hasVendor: vendor,
    hasAdmin: admin,
  });

  return NextResponse.json({
    data: {
      signedIn: true,
      vendor: vendor || admin,
      admin,
      vendorIds,
      roleLabel: membershipRole
        ? String(membershipRole).replace(/_/g, " ")
        : actor.isPlatformStaff
          ? "Platform"
          : null,
      platformRoleLabel: platformRole
        ? PLATFORM_ROLE_LABELS[platformRole as PlatformRole] || platformRole
        : null,
      primaryRoleId: membershipRole,
      platformRoleId: platformRole,
      chromePlane: chrome.plane,
    },
  });
}
