import { NextRequest, NextResponse } from "next/server";
import {
  handleRequireAdminError,
  requireAdminPermission,
} from "@/lib/auth/require-admin";
import {
  getContentReportByPublicId,
  listContentReports,
  updateContentReport,
  type ContentReportStatus,
} from "@/lib/content-reports";
import { FeatureUnavailableError } from "@/lib/offers-mutations";
import { setVendorReviewStatus } from "@/lib/vendor-content";

export async function GET(request: NextRequest) {
  try {
    await requireAdminPermission("content:moderate");
    const status = request.nextUrl.searchParams.get("status") || undefined;
    const rows = await listContentReports({ status, limit: 200 });
    return NextResponse.json({ data: rows });
  } catch (error) {
    if (error instanceof FeatureUnavailableError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message }, data: [] },
        { status: 503 },
      );
    }
    return handleRequireAdminError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdminPermission("content:moderate");
    const body = await request.json();
    const publicId = String(body?.publicId || "");
    const status = String(body?.status || "") as ContentReportStatus;
    const adminNotes = body?.adminNotes ? String(body.adminNotes) : null;
    const hideReview = !!body?.hideReview;

    if (
      !publicId ||
      !["open", "in_review", "resolved", "dismissed"].includes(status)
    ) {
      return NextResponse.json(
        { error: { message: "publicId and valid status required" } },
        { status: 400 },
      );
    }

    const existing = await getContentReportByPublicId(publicId);
    if (!existing) {
      return NextResponse.json(
        { error: { message: "Report not found" } },
        { status: 404 },
      );
    }

    const data = await updateContentReport({
      publicId,
      status,
      adminNotes,
      resolvedByClerkId: admin.user.id,
    });

    if (
      status === "resolved" &&
      hideReview &&
      existing.target_type === "review" &&
      existing.vendor_public_id
    ) {
      await setVendorReviewStatus(
        String(existing.target_id),
        [String(existing.vendor_public_id)],
        "hidden",
      ).catch(() => null);
    }

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof FeatureUnavailableError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 503 },
      );
    }
    return handleRequireAdminError(error);
  }
}
