import { NextRequest, NextResponse } from "next/server";
import { V1_CATEGORIES, V1_EXCLUDED_CATEGORIES } from "@/lib/curation-policy";
import {
  addCatalogueProduct,
  listCatalogue,
  updateCatalogueStatus,
} from "@/lib/catalogue-store";
import type { Product } from "@/types";
import { publicId } from "@/lib/ids";
import { appendUsageEvent } from "@/lib/m1-store";
import {
  handleRequireAdminError,
  requireAdminPermission,
} from "@/lib/auth/require-admin";

export async function GET(request: NextRequest) {
  const vendorId = request.nextUrl.searchParams.get("vendorId") || undefined;
  const products = await listCatalogue(vendorId || undefined);
  return NextResponse.json({ data: products });
}

/**
 * Platform-only canonical product create (+ initial offer for a vendor).
 * Vendors cannot create catalogue products — use /api/os/offers instead.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminPermission("products:create");
    const body = await request.json();
    const name = String(body?.name || "").trim();
    const category = String(body?.category || "").trim();
    const priceMajor = Number(body?.priceMajor ?? body?.price);
    const stock = Number(body?.stock ?? 0);
    const vendorId = String(body?.vendorId || "").trim();

    if (!name || !category || !vendorId || !Number.isFinite(priceMajor)) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID",
            message: "name, category, vendorId, priceMajor required",
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
      properties: {
        productId: product.id,
        vendorId,
        category,
        actorUserId: admin.user.id,
      },
      actorType: "admin",
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ data: product }, { status: 201 });
  } catch (error) {
    return handleRequireAdminError(error);
  }
}

/** Platform-only bulk offer/product status update. */
export async function PATCH(request: NextRequest) {
  try {
    await requireAdminPermission("products:edit");
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
      actorType: "admin",
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ data: { updated } });
  } catch (error) {
    return handleRequireAdminError(error);
  }
}
