import { NextRequest, NextResponse } from "next/server";
import { V1_CATEGORIES, V1_EXCLUDED_CATEGORIES } from "@/lib/curation-policy";
import {
  addCatalogueProduct,
  listCatalogue,
  updateCatalogueStatus,
} from "@/lib/catalogue-store";
import type { Product } from "@/types";
import { DEMO_VENDOR_ID } from "@/lib/tenancy";
import { publicId } from "@/lib/ids";
import { appendUsageEvent } from "@/lib/m1-store";
import { requireVendorActor } from "@/lib/auth/require-vendor";

export async function GET(request: NextRequest) {
  const vendorId = request.nextUrl.searchParams.get("vendorId") || undefined;
  const products = await listCatalogue(vendorId || undefined);
  return NextResponse.json({ data: products });
}

/** Manual vendor listing create - tenant-scoped (M1). */
export async function POST(request: NextRequest) {
  try {
    const gate = await requireVendorActor();
    if (!gate.ok) return gate.response;

    const body = await request.json();
    const name = String(body?.name || "").trim();
    const category = String(body?.category || "").trim();
    const priceMajor = Number(body?.priceMajor ?? body?.price);
    const stock = Number(body?.stock);
    let vendorId =
      String(body?.vendorId || DEMO_VENDOR_ID).trim() || DEMO_VENDOR_ID;
    if (
      !gate.actor.isPlatformAdmin &&
      !gate.actor.vendorIds.includes(vendorId)
    ) {
      vendorId = gate.actor.vendorIds[0] || DEMO_VENDOR_ID;
    }

    if (
      !name ||
      !category ||
      !Number.isFinite(priceMajor) ||
      !Number.isFinite(stock)
    ) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID",
            message: "name, category, priceMajor, stock required",
          },
        },
        { status: 400 },
      );
    }

    const allowed = new Set(V1_CATEGORIES.map((c) => c.toLowerCase()));
    const excluded = new Set(
      V1_EXCLUDED_CATEGORIES.map((c) => c.toLowerCase()),
    );
    if (
      excluded.has(category.toLowerCase()) ||
      !allowed.has(category.toLowerCase())
    ) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_CATEGORY",
            message: `Category not in V1: ${category}`,
          },
        },
        { status: 400 },
      );
    }
    if (
      !Number.isInteger(priceMajor) ||
      priceMajor < 0 ||
      !Number.isInteger(stock) ||
      stock < 0
    ) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID",
            message: "priceMajor and stock must be non-negative integers",
          },
        },
        { status: 400 },
      );
    }

    const product = await addCatalogueProduct({
      name,
      category,
      priceMajor,
      stock,
      description: body?.description ? String(body.description) : undefined,
      image: body?.image ? String(body.image) : undefined,
      vendorId,
      status: "published",
    });

    await appendUsageEvent({
      id: publicId("evt"),
      name: "catalogue.product_created",
      properties: { productId: product.id, vendorId, category },
      actorType: "vendor",
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ data: product }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: { code: "WRITE_FAILED", message: "Could not create product" } },
      { status: 500 },
    );
  }
}

/** Bulk status update for Products module. */
export async function PATCH(request: NextRequest) {
  const gate = await requireVendorActor();
  if (!gate.ok) return gate.response;

  const body = await request.json();
  const ids = Array.isArray(body?.ids)
    ? body.ids.map((id: unknown) => String(id))
    : [];
  const status = String(body?.status || "") as Product["status"];
  if (
    !ids.length ||
    !["published", "draft", "archived"].includes(String(status))
  ) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID",
          message: "ids and status (published|draft|archived) required",
        },
      },
      { status: 400 },
    );
  }

  const updated = await updateCatalogueStatus(ids, status);
  await appendUsageEvent({
    id: publicId("evt"),
    name: "catalogue.bulk_status",
    properties: { count: updated, status },
    actorType: "vendor",
    createdAt: new Date().toISOString(),
  });
  return NextResponse.json({ data: { updated } });
}
