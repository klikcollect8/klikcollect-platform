import { NextResponse } from "next/server";
import { withCatalogueAuth, jsonError } from "@/lib/catalogue/api-guard";
import { listBrands, listCategoryTree } from "@/lib/catalogue/admin-store";
import { getServiceSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await withCatalogueAuth("products:view");
    const url = new URL(req.url);
    const kind = url.searchParams.get("kind") || "meta";

    if (kind === "brands") {
      const brands = await listBrands(url.searchParams.get("q") || undefined);
      return NextResponse.json({ brands });
    }

    if (kind === "categories") {
      const categories = await listCategoryTree();
      return NextResponse.json({ categories });
    }

    if (kind === "vendors") {
      const sb = getServiceSupabase();
      const { data } = await sb
        .from("vendors")
        .select("public_id, name, status")
        .eq("status", "admitted")
        .is("deleted_at", null)
        .order("name")
        .limit(100);
      return NextResponse.json({ vendors: data || [] });
    }

    const [brands, categories] = await Promise.all([
      listBrands(),
      listCategoryTree(),
    ]);
    return NextResponse.json({ brands, categories });
  } catch (err) {
    return jsonError(err);
  }
}
