import { NextResponse } from "next/server";
import { withCatalogueAuth, jsonError } from "@/lib/catalogue/api-guard";
import {
  archiveBrand,
  listBrands,
  upsertBrand,
} from "@/lib/catalogue/admin-store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await withCatalogueAuth("products:view");
    const url = new URL(req.url);
    const brands = await listBrands(url.searchParams.get("q") || undefined, {
      includeArchived: true,
    });
    return NextResponse.json({ brands });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    await withCatalogueAuth("brands:manage");
    const body = await req.json();
    const brand = await upsertBrand({
      publicId: body.publicId || null,
      name: body.name || "",
      description: body.description,
      country: body.country,
      logoUrl: body.logoUrl,
      manufacturer: body.manufacturer,
      aliases: Array.isArray(body.aliases) ? body.aliases : [],
      status: body.status === "archived" ? "archived" : "active",
    });
    return NextResponse.json({ brand });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    await withCatalogueAuth("brands:manage");
    const body = await req.json().catch(() => ({}));
    const id = body.publicId || body.id;
    if (!id) {
      return NextResponse.json({ error: "publicId required" }, { status: 400 });
    }
    const brand = await archiveBrand(String(id));
    return NextResponse.json({ brand });
  } catch (err) {
    return jsonError(err);
  }
}
