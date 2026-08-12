import { NextResponse } from "next/server";
import { withCatalogueAuth, jsonError } from "@/lib/catalogue/api-guard";
import { bulkApproveDiscoveryCandidates } from "@/lib/product-resolver/bulk-approve";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { user } = await withCatalogueAuth("products:create");
    const body = (await req.json()) as {
      ids?: string[];
      defaultCategoryId?: string;
      highConfidenceOnly?: boolean;
    };
    if (!body.defaultCategoryId) {
      return NextResponse.json(
        { error: "defaultCategoryId required for bulk approve" },
        { status: 400 },
      );
    }
    const result = await bulkApproveDiscoveryCandidates({
      ids: body.ids,
      defaultCategoryId: body.defaultCategoryId,
      highConfidenceOnly: body.highConfidenceOnly,
      actor: { userId: user.id, email: user.email || null },
    });
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err);
  }
}
