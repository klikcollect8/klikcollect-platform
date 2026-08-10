import { NextResponse } from "next/server";
import { requireVendorActor } from "@/lib/auth/require-vendor";
import { inviteableRolesForActor } from "@/lib/authz/invite-ceiling";

/** Current vendor/platform actor + permissions for OS nav gating. */
export async function GET() {
  const gate = await requireVendorActor();
  if (!gate.ok) return gate.response;

  const { actor } = gate;
  const primaryVendorId = actor.vendorIds[0] || "";
  const inviteableRoles = primaryVendorId
    ? inviteableRolesForActor(actor.actor, primaryVendorId)
    : [];
  return NextResponse.json({
    data: {
      userId: actor.userId,
      email: actor.email,
      role: actor.role,
      vendorIds: actor.vendorIds,
      isPlatformAdmin: actor.isPlatformAdmin,
      platformRole: actor.actor.platformRole,
      permissions: [...actor.actor.permissions],
      memberships: actor.actor.vendorMemberships,
      inviteableRoles,
    },
  });
}
