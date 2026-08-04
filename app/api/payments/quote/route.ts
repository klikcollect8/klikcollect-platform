import { NextRequest, NextResponse } from "next/server";
import { quoteFees } from "@/lib/fees/engine";

/** Public fee quote (delivery + optional commission preview). */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const areaKey = String(body?.areaKey || "pickup");
    const collectHub = body?.collectHub ? String(body.collectHub) : null;
    const fulfilment =
      body?.fulfilment === "delivery" ? "delivery" : "pickup";

    const quote = await quoteFees({
      lines: Array.isArray(body?.lines)
        ? body.lines.map(
            (l: {
              vendorPublicId?: string;
              goodsMinor?: number;
              productPublicId?: string;
              categoryName?: string;
            }) => ({
              vendorPublicId: String(l.vendorPublicId || "ven_unknown"),
              goodsMinor: Number(l.goodsMinor) || 0,
              productPublicId: l.productPublicId
                ? String(l.productPublicId)
                : undefined,
              categoryName: l.categoryName ? String(l.categoryName) : undefined,
            }),
          )
        : [{ vendorPublicId: "platform", goodsMinor: 0 }],
      areaKey,
      collectHub,
      fulfilment,
    });

    return NextResponse.json({
      data: {
        deliveryMinor: quote.deliveryMinor,
        commissionMinor: quote.commissionMinor,
        goodsMinor: quote.goodsMinor,
        customerTotalMinor: quote.customerTotalMinor,
        rulesApplied: quote.rulesApplied,
      },
    });
  } catch (e) {
    // Fee tables may not exist yet — safe defaults
    return NextResponse.json({
      data: {
        deliveryMinor: 0,
        commissionMinor: 0,
        goodsMinor: 0,
        customerTotalMinor: 0,
        rulesApplied: [],
        fallback: true,
        error: e instanceof Error ? e.message : "quote failed",
      },
    });
  }
}
