import { NextRequest, NextResponse } from "next/server";
import { listCatalogue } from "@/lib/catalogue-store";
import { publicId } from "@/lib/ids";
import { appendUsageEvent } from "@/lib/m1-store";
import {
  requireVendorActor,
  requireVendorPermission,
} from "@/lib/auth/require-vendor";
import { adjustOnHand, availableOf, listMovements } from "@/lib/inventory";
import { withIdempotency, idempotencyKeyFrom } from "@/lib/idempotency";
import { emitVendorActivity } from "@/lib/vendor-activity";

export async function GET(request: NextRequest) {
  const gate = await requireVendorActor();
  if (!gate.ok) return gate.response;

  if (request.nextUrl.searchParams.get("movements") === "1") {
    const movements = await listMovements(50, gate.actor.vendorIds);
    return NextResponse.json({ data: movements });
  }
  const products = await listCatalogue();
  const allowed = new Set(gate.actor.vendorIds);
  // Tenant-scoped only - no platform god-mode on vendor OS APIs.
  const scoped = products.filter((p) => p.vendorId && allowed.has(p.vendorId));

  return NextResponse.json({
    data: scoped.map((p) => ({
      ...p,
      available: availableOf(p),
      onHand: p.onHand ?? p.stock,
      reserved: p.reserved ?? 0,
    })),
  });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const id = String(body?.id || "");
  const onHand = Number(body?.onHand ?? body?.stock);
  const reason = String(body?.reason || "adjust");
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
  if (!existing?.vendorId) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Offer not found" } },
      { status: 404 },
    );
  }

  const gate = await requireVendorPermission("inventory:adjust", {
    vendorId: existing.vendorId,
  });
  if (!gate.ok) return gate.response;

  if (!gate.actor.vendorIds.includes(existing.vendorId)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Not a member of this vendor" } },
      { status: 403 },
    );
  }

  const key = idempotencyKeyFrom(request);
  const result = await withIdempotency(
    key,
    `PATCH /api/os/inventory:${id}:${onHand}`,
    async () => {
      const updated = await adjustOnHand({
        productId: id,
        onHand,
        actorUserId: gate.actor.userId,
        reason,
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
          reason,
          actorUserId: gate.actor.userId,
        },
        actorType: "vendor",
        createdAt: new Date().toISOString(),
      });

      if (updated.vendorId) {
        await emitVendorActivity({
          vendorPublicId: updated.vendorId,
          kind: "stock",
          title: `Stock adjusted · ${updated.name}`,
          body: `On hand set to ${onHand} (${reason})`,
          refType: "product",
          refId: id,
          meta: { onHand, reason },
        });
      }

      return {
        status: 200,
        body: {
          data: {
            ...updated,
            available: availableOf(updated),
          },
        },
      };
    },
  );

  return NextResponse.json(result.body, { status: result.status });
}
