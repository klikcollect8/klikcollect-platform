import { NextResponse } from "next/server";
import { withCatalogueAuth, jsonError } from "@/lib/catalogue/api-guard";
import { resolveBarcode } from "@/lib/product-resolver";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ barcode: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    const { user } = await withCatalogueAuth("barcode:scan");
    const { barcode: raw } = await ctx.params;
    const barcode = decodeURIComponent(raw || "").trim();
    if (!barcode) {
      return NextResponse.json({ error: "Barcode is required" }, { status: 400 });
    }
    const { searchParams } = new URL(req.url);
    const result = await resolveBarcode({
      barcode,
      formatHint: searchParams.get("format"),
      skipExternal: searchParams.get("localOnly") === "1",
      actorClerkUserId: user.id,
      actorEmail: user.email || null,
    });
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err);
  }
}
