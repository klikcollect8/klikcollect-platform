import { NextRequest, NextResponse } from "next/server";
import { requireVendorPermission } from "@/lib/auth/require-vendor";
import {
  createCatalogueCorrection,
  FeatureUnavailableError,
  listCatalogueCorrections,
} from "@/lib/offers-mutations";
import { getOfferById } from "@/lib/offers-store";
import { emitVendorActivity } from "@/lib/vendor-activity";

export async function GET(request: NextRequest) {
  const gate = await requireVendorPermission("catalogue:request_correction");
  if (!gate.ok) return gate.response;

  const vendorId =
    request.nextUrl.searchParams.get("vendorId") ||
    gate.actor.vendorIds[0] ||
    "";
  if (!vendorId || !gate.actor.vendorIds.includes(vendorId)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Vendor out of scope" } },
      { status: 403 },
    );
  }

  try {
    const rows = await listCatalogueCorrections({ vendorPublicId: vendorId });
    return NextResponse.json({ data: rows });
  } catch (e) {
    if (e instanceof FeatureUnavailableError) {
      return NextResponse.json(
        { error: { code: e.code, message: e.message }, data: [] },
        { status: 503 },
      );
    }
    throw e;
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireVendorPermission("catalogue:request_correction");
  if (!gate.ok) return gate.response;

  const body = await request.json();
  const offerId = body?.offerId ? String(body.offerId) : "";
  const message = String(body?.message || "").trim();
  const fields =
    body?.fields && typeof body.fields === "object"
      ? (body.fields as Record<string, string>)
      : {};

  let vendorId = gate.actor.vendorIds[0] || "";
  let productPublicId = String(body?.productId || "").trim();

  if (offerId) {
    const offer = await getOfferById(offerId, { includeUnpublished: true });
    if (!offer?.vendorId || !gate.actor.vendorIds.includes(offer.vendorId)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Offer out of scope" } },
        { status: 403 },
      );
    }
    vendorId = offer.vendorId;
    productPublicId = offer.productId || productPublicId;
  }

  if (!productPublicId || !message || message.length < 5) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID",
          message: "productId (or offerId) and message (min 5 chars) required",
        },
      },
      { status: 400 },
    );
  }

  let created: { publicId: string };
  try {
    created = await createCatalogueCorrection({
      productPublicId,
      offerPublicId: offerId || undefined,
      vendorPublicId: vendorId,
      actorClerkId: gate.actor.userId,
      fields,
      message,
    });
  } catch (e) {
    if (e instanceof FeatureUnavailableError) {
      return NextResponse.json(
        { error: { code: e.code, message: e.message } },
        { status: 503 },
      );
    }
    throw e;
  }

  await emitVendorActivity({
    vendorPublicId: vendorId,
    kind: "system",
    title: "Catalogue correction requested",
    body: message.slice(0, 120),
    refType: "catalogue_correction",
    refId: created.publicId,
  });

  return NextResponse.json({ data: created }, { status: 201 });
}
