import { NextResponse } from "next/server";
import { withCatalogueAuth, jsonError } from "@/lib/catalogue/api-guard";
import { searchProducts } from "@/lib/product-resolver/resolve";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await withCatalogueAuth("barcode:scan");
    const body = (await req.json().catch(() => ({}))) as { q?: string };
    const q = (body.q || "").trim();
    if (q.length < 2) {
      return NextResponse.json(
        { error: "Search query must be at least 2 characters" },
        { status: 400 },
      );
    }
    // Never persist search hits into discovery — only explicit "Add to queue" / scan commit
    const result = await searchProducts({ q, persist: false });
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err);
  }
}
