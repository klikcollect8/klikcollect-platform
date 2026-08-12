import { NextResponse } from "next/server";
import { withCatalogueAuth, jsonError } from "@/lib/catalogue/api-guard";
import {
  listSourceRegistry,
  updateSourceRegistry,
  probeSourceHealth,
} from "@/lib/product-resolver/source-registry";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await withCatalogueAuth("products:view");
    const sources = await listSourceRegistry();
    return NextResponse.json({ sources });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    await withCatalogueAuth("products:edit");
    const body = (await req.json()) as {
      providerId?: string;
      enabled?: boolean;
      priority?: number;
      displayName?: string;
      probe?: boolean;
    };

    if (body.probe) {
      const health = await probeSourceHealth();
      const sources = await listSourceRegistry();
      return NextResponse.json({ sources, health: health.results });
    }

    if (!body.providerId) {
      return NextResponse.json(
        { error: "providerId required" },
        { status: 400 },
      );
    }
    const row = await updateSourceRegistry({
      providerId: body.providerId,
      enabled: body.enabled,
      priority: body.priority,
      displayName: body.displayName,
    });
    return NextResponse.json({ source: row });
  } catch (err) {
    return jsonError(err);
  }
}
