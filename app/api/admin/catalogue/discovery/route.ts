import { NextResponse } from "next/server";
import { withCatalogueAuth, jsonError } from "@/lib/catalogue/api-guard";
import {
  bulkUpdateDiscoveryStatus,
  dismissDiscoveryCandidate,
  getDiscoveryCandidate,
  listDiscoveryBrands,
  listDiscoveryCandidates,
  restoreDiscoveryCandidate,
  upsertDiscoveryCandidate,
} from "@/lib/product-resolver/discovery";
import { searchProducts } from "@/lib/product-resolver/resolve";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await withCatalogueAuth("products:view");
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (id) {
      const item = await getDiscoveryCandidate(id);
      if (!item) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json({ item });
    }

    if (url.searchParams.get("meta") === "brands") {
      const status =
        (url.searchParams.get("status") as
          | "pending"
          | "imported"
          | "dismissed") || "pending";
      const brands = await listDiscoveryBrands(status);
      return NextResponse.json({ brands });
    }

    const q = url.searchParams.get("q") || undefined;
    const status =
      (url.searchParams.get("status") as
        | "pending"
        | "imported"
        | "dismissed") || "pending";

    const result = await listDiscoveryCandidates({
      status,
      q,
      source: url.searchParams.get("source") || undefined,
      provider: url.searchParams.get("provider") || undefined,
      brand: url.searchParams.get("brand") || undefined,
      limit: Number(url.searchParams.get("limit") || 40),
      offset: Number(url.searchParams.get("offset") || 0),
    });

    // Live related products for any name / category / brand query (temporary list)
    let related: Array<{
      barcode: string;
      name: string | null;
      brand: string | null;
      image: string | null;
      provider: string;
      inCatalogue: boolean;
      localProductId?: string | null;
      quantity?: string | null;
      nutriscore?: string | null;
      categoryHint?: string | null;
      temporary: true;
    }> = [];

    if (q && q.trim().length >= 2 && status === "pending") {
      const live = await searchProducts({
        q: q.trim(),
        persist: false,
        pageSize: 28,
      });
      const queueBarcodes = new Set(
        result.items.map((i) => i.barcode).filter(Boolean) as string[],
      );
      related = live.external
        .filter((e) => !e.inCatalogue && e.barcode && !queueBarcodes.has(e.barcode))
        .map((e) => ({
          barcode: e.barcode,
          name: e.name,
          brand: e.brand,
          image: e.image,
          provider: e.provider,
          inCatalogue: e.inCatalogue,
          localProductId: e.localProductId,
          quantity: e.quantity,
          nutriscore: e.nutriscore,
          categoryHint: e.categoryHint,
          temporary: true as const,
        }));
    }

    return NextResponse.json({ ...result, related });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    await withCatalogueAuth("products:create");
    const body = (await req.json()) as {
      id?: string;
      ids?: string[];
      action?: "dismiss" | "restore" | "enqueue";
      /** For action=enqueue from live related search */
      candidate?: {
        barcode: string;
        name?: string | null;
        brand?: string | null;
        provider?: string;
        image?: string | null;
        quantity?: string | null;
        nutriscore?: string | null;
        categoryHint?: string | null;
      };
    };

    if (body.action === "enqueue" && body.candidate?.barcode) {
      const c = body.candidate;
      const discoveryId = await upsertDiscoveryCandidate({
        barcode: c.barcode,
        name: c.name || null,
        brand: c.brand || null,
        provider: c.provider || "open_food_facts",
        externalProductId: c.barcode,
        source: "search",
        payload: {
          barcode: c.barcode,
          name: c.name,
          brand: c.brand,
          image: c.image,
          quantity: c.quantity ? { value: c.quantity } : undefined,
          nutriscore: c.nutriscore ? { value: c.nutriscore } : undefined,
          externalCategories: c.categoryHint
            ? { value: [c.categoryHint] }
            : undefined,
          images: c.image
            ? [{ url: c.image, role: "front", provider: "open_food_facts", sourceUrl: c.image }]
            : [],
        },
      });
      return NextResponse.json({ ok: true, discoveryId });
    }

    if (body.ids?.length && body.action && body.action !== "enqueue") {
      const updated = await bulkUpdateDiscoveryStatus({
        ids: body.ids,
        action: body.action,
      });
      return NextResponse.json({ ok: true, updated });
    }

    if (!body.id || !body.action || body.action === "enqueue") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const ok =
      body.action === "dismiss"
        ? await dismissDiscoveryCandidate(body.id)
        : await restoreDiscoveryCandidate(body.id);

    if (!ok) {
      return NextResponse.json(
        { error: `Could not ${body.action}` },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
