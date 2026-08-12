import { NextResponse } from "next/server";
import { withCatalogueAuth, jsonError } from "@/lib/catalogue/api-guard";
import { getIntelligenceAnalytics } from "@/lib/catalogue/intelligence-analytics";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await withCatalogueAuth("products:view");
    const data = await getIntelligenceAnalytics();
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}
