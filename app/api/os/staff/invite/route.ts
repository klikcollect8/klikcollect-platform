import { NextRequest, NextResponse } from "next/server";
import { requireVendorPermission } from "@/lib/auth/require-vendor";
import { inviteStaffMembership } from "@/lib/authz/memberships";
import {
  isEnabledStaffRole,
  type StaffMembershipRole,
} from "@/lib/authz/role-ids";
import { emitVendorActivity } from "@/lib/vendor-activity";
import { notifyVendorStaff } from "@/lib/vendor-notifications";

/** Vendor Owner / Admin invite staff into their tenant. */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const vendorId = String(body?.vendorId || "");
  const email = String(body?.email || "")
    .trim()
    .toLowerCase();
  const role = String(body?.role || "vendor_staff");

  const gate = await requireVendorPermission("staff:invite", { vendorId });
  if (!gate.ok) return gate.response;

  if (!email.includes("@") || !vendorId || !isEnabledStaffRole(role)) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID",
          message: "email, vendorId, and vendor store role required",
        },
      },
      { status: 400 },
    );
  }

  if (!gate.actor.vendorIds.includes(vendorId)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Vendor out of scope" } },
      { status: 403 },
    );
  }

  const row = await inviteStaffMembership({
    email,
    vendorId,
    storeId: body?.storeId || null,
    role: role as StaffMembershipRole,
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
