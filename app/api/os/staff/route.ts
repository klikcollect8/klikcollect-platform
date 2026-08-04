import { NextRequest, NextResponse } from "next/server";
import { requireVendorPermission } from "@/lib/auth/require-vendor";
import { getServiceSupabase } from "@/lib/supabase/admin";
import {
  inviteStaffMembership,
  revokeStaffMembership,
} from "@/lib/authz/memberships";
import { isEnabledStaffRole } from "@/lib/authz/role-ids";
import { emitVendorActivity } from "@/lib/vendor-activity";
import { notifyVendorStaff } from "@/lib/vendor-notifications";

export async function GET(request: NextRequest) {
  const vendorId = request.nextUrl.searchParams.get("vendorId") || "";
  const gate = await requireVendorPermission("staff:view", {
    vendorId: vendorId || undefined,
  });
  if (!gate.ok) return gate.response;

  const supabase = getServiceSupabase();
  let q = supabase
    .from("staff_memberships")
    .select("*")
    .in("status", ["active", "invited"])
    .order("created_at", { ascending: false });
  if (vendorId) {
    if (!gate.actor.vendorIds.includes(vendorId)) {
      return NextResponse.json(
        { error: { message: "Vendor out of scope" } },
        { status: 403 },
      );
    }
    q = q.eq("vendor_id", vendorId);
  } else if (gate.actor.vendorIds.length) {
    q = q.in("vendor_id", gate.actor.vendorIds);
  } else {
    return NextResponse.json({ data: [] });
  }
  const { data, error } = await q;
  if (error) {
    return NextResponse.json(
      { error: { message: error.message } },
      { status: 500 },
    );
  }
  return NextResponse.json({ data: data || [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const action = String(body?.action || "invite");
  const vendorId = String(body?.vendorId || "");

  if (action === "revoke") {
    const gate = await requireVendorPermission("staff:revoke", { vendorId });
    if (!gate.ok) return gate.response;
    const clerkUserId = String(body?.clerkUserId || "");
    const ok = await revokeStaffMembership(clerkUserId, vendorId);
    if (ok) {
      await emitVendorActivity({
        vendorPublicId: vendorId,
        kind: "system",
        title: "Staff access revoked",
        body: clerkUserId,
        refType: "staff",
        refId: clerkUserId,
      });
      await notifyVendorStaff({
        vendorPublicId: vendorId,
        title: "Staff access revoked",
        body: clerkUserId.slice(0, 24),
        href: "/app/staff",
        roles: ["vendor_owner", "vendor_admin"],
        excludeClerkUserIds: [clerkUserId],
      });
    }
    return NextResponse.json({ data: { ok } });
  }

  const gate = await requireVendorPermission("staff:invite", { vendorId });
  if (!gate.ok) return gate.response;

  const email = String(body?.email || "")
    .toLowerCase()
    .trim();
  const role = String(body?.role || "vendor_staff");
  if (!email.includes("@") || !isEnabledStaffRole(role)) {
    return NextResponse.json(
      {
        error: {
          message: "Valid email and vendor store role required",
        },
      },
      { status: 400 },
    );
  }
  if (!gate.actor.vendorIds.includes(vendorId)) {
    return NextResponse.json(
      { error: { message: "Vendor out of scope" } },
      { status: 403 },
    );
  }

  const row = await inviteStaffMembership({
    email,
    vendorId,
    storeId: body?.storeId || null,
    role,
  });
  await emitVendorActivity({
    vendorPublicId: vendorId,
    kind: "system",
    title: "Staff invited",
    body: `${email} · ${role}`,
    refType: "staff",
    refId: email,
    meta: { role },
  });
  await notifyVendorStaff({
    vendorPublicId: vendorId,
    title: "Staff invited",
    body: `${email} as ${role}`,
    href: "/app/staff",
    roles: ["vendor_owner", "vendor_admin"],
  });
  return NextResponse.json({ data: row });
}
