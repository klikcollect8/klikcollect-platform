import { NextResponse } from "next/server";
import { withCatalogueAuth, jsonError } from "@/lib/catalogue/api-guard";
import {
  mergeProducts,
  previewMergeProducts,
} from "@/lib/catalogue/merge-products";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await withCatalogueAuth("products:edit");
    const url = new URL(req.url);
    const targetPublicId = url.searchParams.get("target") || "";
    const sourcePublicId = url.searchParams.get("source") || "";
    if (!targetPublicId || !sourcePublicId) {
      return NextResponse.json(
        { error: "target and source query params required" },
        { status: 400 },
      );
    }
    const preview = await previewMergeProducts(targetPublicId, sourcePublicId);
    return NextResponse.json({
      target: preview.target,
      source: preview.source,
      conflicts: preview.conflicts,
      targetOffers: preview.targetOffers,
      sourceOffers: preview.sourceOffers,
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const { user } = await withCatalogueAuth("products:edit");
    const body = (await req.json()) as {
      targetPublicId?: string;
      sourcePublicId?: string;
      reason?: string;
      fieldChoices?: Array<{ field: string; fromSource: boolean }>;
    };
    if (!body.targetPublicId || !body.sourcePublicId) {
      return NextResponse.json(
        { error: "targetPublicId and sourcePublicId required" },
        { status: 400 },
      );
    }
    const result = await mergeProducts({
      targetPublicId: body.targetPublicId,
      sourcePublicId: body.sourcePublicId,
      fieldChoices: body.fieldChoices,
      reason: body.reason,
      actor: { userId: user.id, email: user.email || null },
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return jsonError(err);
  }
}
