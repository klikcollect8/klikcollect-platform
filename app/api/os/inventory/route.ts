import { NextRequest, NextResponse } from "next/server";
import { listCatalogue } from "@/lib/catalogue-store";
import { ensureNairobiSeed } from "@/lib/seed-nairobi";
import { publicId } from "@/lib/ids";
import { appendUsageEvent } from "@/lib/m1-store";
import { requireVendorActor } from "@/lib/auth/require-vendor";
import { adjustOnHand, availableOf, listMovements } from "@/lib/inventory";
import { withIdempotency, idempotencyKeyFrom } from "@/lib/idempotency";

export async function GET(request: NextRequest) {
  await ensureNairobiSeed();
  if (request.nextUrl.searchParams.get("movements") === "1") {
    const movements = await listMovements(50);
    return NextResponse.json({ data: movements });
  }
  const products = await listCatalogue();
  return NextResponse.json({
    data: products.map((p) => ({
      ...p,
      available: availableOf(p),
      onHand: p.onHand ?? p.stock,
      reserved: p.reserved ?? 0,
    })),
  });
}

export async function PATCH(request: NextRequest) {
  const gate = await requireVendorActor();
  if (!gate.ok) return gate.response;

  const body = await request.json();
  const id = String(body?.id || "");
  const onHand = Number(body?.onHand ?? body?.stock);
  if (!id || !Number.isInteger(onHand) || onHand < 0) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID",
          message: "id and non-negative integer onHand/stock required",
        },
      },
      { status: 400 },
    );
  }

  const existing = (await listCatalogue()).find((p) => p.id === id);
  if (
    existing?.vendorId &&
    !gate.actor.isPlatformAdmin &&
    !gate.actor.vendorIds.includes(existing.vendorId) &&
    !gate.actor.vendorIds.includes("ven_demo_founding")
  ) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Not a member of this vendor" } },
      { status: 403 },
    );
  }

  const key = idempotencyKeyFrom(request);
  const result = await withIdempotency(key, `PATCH /api/os/inventory:${id}:${onHand}`, async () => {
    const updated = await adjustOnHand({
      productId: id,
      onHand,
      actorUserId: gate.actor.userId,
    });
    if (!updated) {
      return {
        status: 404,
        body: { error: { code: "NOT_FOUND", message: "Product not found" } },
      };
    }

    await appendUsageEvent({
      id: publicId("evt"),
      name: "os.inventory_adjusted",
      properties: {
        productId: id,
        onHand,
        reserved: updated.reserved,
        available: availableOf(updated),
        name: updated.name,
        actorUserId: gate.actor.userId,
      },
      actorType: "vendor",
      createdAt: new Date().toISOString(),
    });

    return {
      status: 200,
      body: {
        data: {
          ...updated,
          available: availableOf(updated),
        },
      },
    };
  });

  return NextResponse.json(result.body, { status: result.status });
}
