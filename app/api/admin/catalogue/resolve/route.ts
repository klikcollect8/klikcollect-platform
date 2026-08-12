import { NextResponse } from "next/server";
import { withCatalogueAuth, jsonError } from "@/lib/catalogue/api-guard";
import { resolveBarcode } from "@/lib/product-resolver";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { user } = await withCatalogueAuth("barcode:scan");
    const body = (await req.json().catch(() => ({}))) as {
      barcode?: string;
      query?: string;
      formatHint?: string;
      skipExternal?: boolean;
    };

    const barcode = (body.barcode || body.query || "").trim();
    if (!barcode) {
      return NextResponse.json({ error: "Barcode is required" }, { status: 400 });
    }

    const result = await resolveBarcode({
      barcode,
      formatHint: body.formatHint,
      skipExternal: Boolean(body.skipExternal),
      actorClerkUserId: user.id,
      actorEmail: user.email || null,
    });

    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err);
  }
}
