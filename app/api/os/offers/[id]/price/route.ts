import { NextRequest, NextResponse } from "next/server";
import { requireVendorPermission } from "@/lib/auth/require-vendor";
import { updateOfferPrice } from "@/lib/offers-mutations";
import { getOfferById } from "@/lib/offers-store";
import { emitVendorActivity } from "@/lib/vendor-activity";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const offer = await getOfferById(id, { includeUnpublished: true });
  if (!offer?.vendorId) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Offer not found" } },
      { status: 404 },
    );
  }

  const gate = await requireVendorPermission("offers:price", {
    vendorId: offer.vendorId,
  });
  if (!gate.ok) return gate.response;

  const body = await request.json();
  const priceMajor = Number(body?.priceMajor ?? body?.price);
  if (!Number.isInteger(priceMajor) || priceMajor < 0) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID",
          message: "priceMajor must be a non-negative integer (KES)",
        },
      },
      { status: 400 },
    );
  }

  const updated = await updateOfferPrice({
    offerPublicId: id,
    vendorPublicId: offer.vendorId,
    actorClerkId: gate.actor.userId,
    priceMajor,
    reason: body?.reason ? String(body.reason) : undefined,
  });
  if (!updated) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Offer not found" } },
      { status: 404 },
    );
  }

  await emitVendorActivity({
    vendorPublicId: offer.vendorId,
    kind: "system",
    title: `Price updated · ${updated.productId || id}`,
    body: `New price KES ${priceMajor}`,
    refType: "offer",
    refId: id,
  });

  return NextResponse.json({ data: updated });
}
