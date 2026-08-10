import { NextRequest, NextResponse } from "next/server";
import {
  findDeliverySuggestions,
  type OptimizeCartLine,
} from "@/lib/checkout/delivery-optimize";

type Body = {
  lines?: OptimizeCartLine[];
  drop?: { lat?: number; lng?: number } | null;
  areaLabel?: string | null;
};

/**
 * POST /api/checkout/delivery-optimize
 * Marketplace suggestions: switch vendor / avoid stop fee.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;
    const lines = Array.isArray(body.lines) ? body.lines.slice(0, 30) : [];
    const drop =
      body.drop &&
      Number.isFinite(body.drop.lat) &&
      Number.isFinite(body.drop.lng)
        ? { lat: Number(body.drop.lat), lng: Number(body.drop.lng) }
        : null;

    const result = await findDeliverySuggestions({
      lines,
      drop,
      areaLabel: body.areaLabel ?? null,
    });

    return NextResponse.json({ data: result });
  } catch (e) {
    console.error("POST /api/checkout/delivery-optimize", e);
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "optimize failed",
        data: { currentQuote: null, suggestions: [] },
      },
      { status: 200 },
    );
  }
}
