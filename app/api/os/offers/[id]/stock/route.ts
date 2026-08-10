import { NextRequest, NextResponse } from "next/server";
import { requireVendorPermission } from "@/lib/auth/require-vendor";
import { setOfferStock } from "@/lib/offers-mutations";
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

  const gate = await requireVendorPermission("inventory:adjust", {
    vendorId: offer.vendorId,
  });
  if (!gate.ok) return gate.response;

  const body = await request.json();
  const onHand = Number(body?.onHand ?? body?.stock);
  if (!Number.isInteger(onHand) || onHand < 0) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID",
          message: "onHand must be a non-negative integer",
        },
      },
      { status: 400 },
    );
  }

  const updated = await setOfferStock({
    offerPublicId: id,
    vendorPublicId: offer.vendorId,
    actorClerkId: gate.actor.userId,
    onHand,
    reason: body?.reason ? String(body.reason) : "adjust",
  });
  if (!updated) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Offer not found" } },
      { status: 404 },
    );
  }

  await emitVendorActivity({
    vendorPublicId: offer.vendorId,
    kind: "stock",
    title: `Stock adjusted`,
    body: `On hand set to ${onHand}`,
    refType: "offer",
    refId: id,
  });

  return NextResponse.json({ data: updated });
}
