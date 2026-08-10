import { NextResponse } from "next/server";
import { withCatalogueAuth, jsonError } from "@/lib/catalogue/api-guard";
import {
  listAdminProducts,
  upsertDraftProduct,
  type AdminListFilters,
} from "@/lib/catalogue/admin-store";
import type { CatalogueDraft } from "@/lib/catalogue/product-draft";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await withCatalogueAuth("products:view");
    const url = new URL(req.url);
    const result = await listAdminProducts({
      q: url.searchParams.get("q") || undefined,
      status: url.searchParams.get("status") || undefined,
      kind: url.searchParams.get("kind") || undefined,
      categoryId: url.searchParams.get("categoryId") || undefined,
      brandId: url.searchParams.get("brandId") || undefined,
      missingImage: url.searchParams.get("missingImage") === "1",
      missingBarcode: url.searchParams.get("missingBarcode") === "1",
      missingSeo: url.searchParams.get("missingSeo") === "1",
      hasVariants: url.searchParams.get("hasVariants") === "1",
      noOffers: url.searchParams.get("noOffers") === "1",
      hasOffers: url.searchParams.get("hasOffers") === "1",
      featured: url.searchParams.get("featured") === "1",
      guideMinMinor: url.searchParams.get("guideMin")
        ? Math.round(Number(url.searchParams.get("guideMin")) * 100)
        : undefined,
      guideMaxMinor: url.searchParams.get("guideMax")
        ? Math.round(Number(url.searchParams.get("guideMax")) * 100)
        : undefined,
      sort: (url.searchParams.get("sort") as AdminListFilters["sort"]) || undefined,
      page: Number(url.searchParams.get("page") || 1),
      pageSize: Number(url.searchParams.get("pageSize") || 48),
    });
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const gate = await withCatalogueAuth("products:create");
    const body = (await req.json()) as CatalogueDraft;
    const product = await upsertDraftProduct(body, {
      userId: gate.user.id,
      email: gate.user.email,
    });
    return NextResponse.json({ product });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const gate = await withCatalogueAuth("products:edit");
    const body = (await req.json()) as CatalogueDraft;
    if (!body.publicId) {
      return NextResponse.json({ error: "publicId is required" }, { status: 400 });
    }
    const product = await upsertDraftProduct(body, {
      userId: gate.user.id,
      email: gate.user.email,
    });
    return NextResponse.json({ product });
  } catch (err) {
    return jsonError(err);
  }
}
