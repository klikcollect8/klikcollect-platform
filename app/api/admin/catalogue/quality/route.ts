import { NextResponse } from "next/server";
import { withCatalogueAuth, jsonError } from "@/lib/catalogue/api-guard";
import { getQualityCentreData } from "@/lib/catalogue/quality-centre";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await withCatalogueAuth("products:view");
    const data = await getQualityCentreData();
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}
