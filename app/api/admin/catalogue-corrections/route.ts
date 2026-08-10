import { NextRequest, NextResponse } from "next/server";
import {
  handleRequireAdminError,
  requireAdminPermission,
} from "@/lib/auth/require-admin";
import { listCatalogueCorrections } from "@/lib/offers-mutations";
import { getServiceSupabase } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    await requireAdminPermission("products:edit");
    const status = request.nextUrl.searchParams.get("status") || undefined;
    const rows = await listCatalogueCorrections({ status, limit: 200 });
    return NextResponse.json({ data: rows });
  } catch (error) {
    return handleRequireAdminError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdminPermission("products:edit");
    const body = await request.json();
    const publicId = String(body?.publicId || "");
    const status = String(body?.status || "");
    const adminNotes = body?.adminNotes ? String(body.adminNotes) : null;

    if (
      !publicId ||
      !["open", "in_review", "resolved", "rejected"].includes(status)
    ) {
      return NextResponse.json(
        { error: { message: "publicId and valid status required" } },
        { status: 400 },
      );
    }

    const sb = getServiceSupabase();
    const patch: Record<string, unknown> = {
      status,
      admin_notes: adminNotes,
      updated_at: new Date().toISOString(),
    };
    if (status === "resolved" || status === "rejected") {
      patch.resolved_at = new Date().toISOString();
      patch.resolved_by_clerk_id = admin.user.id;
    }

    const { data, error } = await sb
      .from("catalogue_correction_requests")
      .update(patch)
      .eq("public_id", publicId)
      .select("*")
      .maybeSingle();
    if (error) {
      return NextResponse.json(
        { error: { message: error.message } },
        { status: 500 },
      );
    }
    return NextResponse.json({ data });
  } catch (error) {
    return handleRequireAdminError(error);
  }
}
