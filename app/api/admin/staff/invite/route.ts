import { NextRequest, NextResponse } from "next/server";
import {
  requireAdminPermission,
  handleRequireAdminError,
} from "@/lib/auth/require-admin";
import {
  invitePlatformMembership,
  inviteStaffMembership,
} from "@/lib/authz/memberships";
import {
  isPlatformRole,
  isStaffMembershipRole,
  type PlatformRole,
  type StaffMembershipRole,
} from "@/lib/authz/role-ids";

/**
 * Phase 3 - invite platform or vendor staff (membership status = invited).
 * Email binding happens on first sign-in via clerk_user_id email: prefix.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdminPermission("staff:invite");
    const body = await request.json();
    const email = String(body?.email || "")
      .trim()
      .toLowerCase();
    const scope = String(body?.scope || "platform");
    const role = String(body?.role || "");

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Valid email required" },
        { status: 400 },
      );
    }

    if (scope === "platform") {
      if (!isPlatformRole(role)) {
        return NextResponse.json(
          { error: "Invalid platform role" },
          { status: 400 },
        );
      }
      const row = await invitePlatformMembership({
        email,
        role: role as PlatformRole,
      });
      return NextResponse.json({
        data: row,
        message: row
          ? "Platform invite created"
          : "Invite recorded locally unavailable - check Supabase",
      });
    }

    const vendorId = String(body?.vendorId || "");
    // Admin may assign any staff membership role; vendor store invites use ENABLED_STAFF_ROLES only.
    if (!vendorId || !isStaffMembershipRole(role)) {
      return NextResponse.json(
        { error: "vendorId and valid staff role required" },
        { status: 400 },
      );
    }

    const row = await inviteStaffMembership({
      email,
      vendorId,
      storeId: body?.storeId || null,
      role: role as StaffMembershipRole,
    });

    return NextResponse.json({
      data: row,
      message: row
        ? "Vendor staff invite created"
        : "Invite failed - check Supabase",
    });
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      "status" in error &&
      ((error as Error & { status: number }).status === 401 ||
        (error as Error & { status: number }).status === 403)
    ) {
      return handleRequireAdminError(error) as NextResponse;
    }
    const message = error instanceof Error ? error.message : "Invite failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
