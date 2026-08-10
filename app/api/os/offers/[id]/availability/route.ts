import { NextRequest, NextResponse } from "next/server";
import { requireVendorPermission } from "@/lib/auth/require-vendor";
import { updateOfferAvailability } from "@/lib/offers-mutations";
import { getOfferById } from "@/lib/offers-store";
import { emitVendorActivity } from "@/lib/vendor-activity";
import { notifyVendorStaff } from "@/lib/vendor-notifications";

type Ctx = { params: Promise<{ id: string }> };

const ALLOWED = new Set(["published", "draft", "archived"]);

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const offer = await getOfferById(id, { includeUnpublished: true });
  if (!offer?.vendorId) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Offer not found" } },
      { status: 404 },
    );
  }

  const gate = await requireVendorPermission("offers:availability", {
    vendorId: offer.vendorId,
  });
  if (!gate.ok) return gate.response;

  const body = await request.json();
  const status = String(body?.status || "");
  if (!ALLOWED.has(status)) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID",
          message: "status must be published, draft, or archived",
        },
      },
      { status: 400 },
    );
  }

  const updated = await updateOfferAvailability({
    offerPublicId: id,
    vendorPublicId: offer.vendorId,
    status: status as "published" | "draft" | "archived",
  });
  if (!updated) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Offer not found" } },
      { status: 404 },
    );
  }

  const label =
    status === "published"
      ? "Offer resumed (selling)"
      : status === "draft"
        ? "Offer paused"
        : "Offer archived";

  await emitVendorActivity({
    vendorPublicId: offer.vendorId,
    kind: "system",
    title: label,
    body: updated.productId || id,
    refType: "offer",
    refId: id,
    meta: { status },
  });

  if (status === "draft" || status === "published") {
    await notifyVendorStaff({
      vendorPublicId: offer.vendorId,
      title: label,
      body: String(updated.productId || id).slice(0, 80),
      href: `/app/products/${id}`,
      roles: ["vendor_owner", "vendor_admin", "store_manager"],
      excludeClerkUserIds: [gate.actor.userId],
    });
  }

  return NextResponse.json({ data: updated });
}
