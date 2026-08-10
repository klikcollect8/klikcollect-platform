import { NextResponse } from "next/server";
import { requireVendorActor } from "@/lib/auth/require-vendor";
import { inviteableRolesForActor } from "@/lib/authz/invite-ceiling";
import { getServiceSupabase } from "@/lib/supabase/admin";

/** Current vendor/platform actor + permissions for OS nav gating. */
export async function GET() {
  const gate = await requireVendorActor();
  if (!gate.ok) return gate.response;

  const { actor } = gate;
  const primaryVendorId = actor.vendorIds[0] || "";
  const inviteableRoles = primaryVendorId
    ? inviteableRolesForActor(actor.actor, primaryVendorId)
    : [];

  let storeName: string | null = null;
  if (primaryVendorId) {
    try {
      const sb = getServiceSupabase();
      const [{ data: profile }, { data: vendor }] = await Promise.all([
        sb
          .from("vendor_profiles")
          .select("display_name")
          .eq("vendor_public_id", primaryVendorId)
          .maybeSingle(),
        sb
          .from("vendors")
          .select("name")
          .eq("public_id", primaryVendorId)
          .maybeSingle(),
      ]);
      storeName = profile?.display_name || vendor?.name || null;
    } catch {
      storeName = null;
    }
  }

  return NextResponse.json({
    data: {
      userId: actor.userId,
      email: actor.email,
      role: actor.role,
      vendorIds: actor.vendorIds,
      storeName,
      isPlatformAdmin: actor.isPlatformAdmin,
      platformRole: actor.actor.platformRole,
      permissions: [...actor.actor.permissions],
      memberships: actor.actor.vendorMemberships,
      inviteableRoles,
    },
  });
}
