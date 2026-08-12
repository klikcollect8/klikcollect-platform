import { NextRequest, NextResponse } from "next/server";
import {
  fetchHeavyRainNear,
  nairobiHourBucket,
  quoteClassicPickup,
  quoteHomeDeliveryLive,
  quoteHybridConsolidate,
  type Coord,
} from "@/lib/checkout/delivery-pricing";
import { checkCoordinate } from "@/lib/location/validate";

type Body = {
  fulfilment?: "pickup" | "delivery";
  collectMode?: "classic" | "hybrid";
  hubIndex?: number;
  zoneId?: string | null;
  areaLabel?: string | null;
  drop?: { lat?: number; lng?: number } | null;
  shops?: Array<{ lat?: number; lng?: number } | null>;
};

const quoteCache = new Map<
  string,
  { at: number; payload: Record<string, unknown> }
>();
const CACHE_TTL_MS = 60_000;

function cacheKey(
  body: Body,
  hourBucket: string,
  rainFlag: string,
): string {
  const drop = body.drop;
  const shops = (body.shops || [])
    .filter((s) => s && Number.isFinite(s.lat) && Number.isFinite(s.lng))
    .map((s) => `${Number(s!.lat).toFixed(4)},${Number(s!.lng).toFixed(4)}`)
    .join("|");
  return [
    body.fulfilment || "",
    body.collectMode || "",
    body.zoneId || "",
    (body.areaLabel || "").toLowerCase().slice(0, 40),
    drop && Number.isFinite(drop.lat) && Number.isFinite(drop.lng)
      ? `${Number(drop.lat).toFixed(4)},${Number(drop.lng).toFixed(4)}`
      : "",
    shops,
    String(body.hubIndex ?? 0),
    hourBucket,
    rainFlag,
  ].join("::");
}

/**
 * POST /api/checkout/delivery-quote
 * Road-distance delivery quote + operational add-ons (no fee ceiling).
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;
    const hourBucket = nairobiHourBucket();

    let drop =
      body.drop &&
      Number.isFinite(body.drop.lat) &&
      Number.isFinite(body.drop.lng)
        ? { lat: Number(body.drop.lat), lng: Number(body.drop.lng) }
        : null;
    let dropFlagged = false;
    if (drop) {
      const check = checkCoordinate(drop.lat, drop.lng);
      if (check.reason === "invalid_range") {
        // Malformed coordinates are a hard failure — the client sent garbage.
        return NextResponse.json(
          {
            error: {
              code: "INVALID_COORDINATES",
              message: "Delivery coordinates are out of range",
              reason: check.reason,
            },
          },
          { status: 422 },
        );
      }
      if (check.reason === "suspicious" || check.reason === "outside_kenya") {
        // Placeholder / out-of-country pins: fall back to zone pricing rather
        // than routing to null island.
        drop = null;
        dropFlagged = true;
      }
    }

    const heavyRain =
      body.fulfilment === "delivery" && drop
        ? await fetchHeavyRainNear(drop)
        : false;
    const rainFlag = heavyRain ? "rain" : "dry";

    const key = cacheKey(body, hourBucket, rainFlag);
    const hit = quoteCache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return NextResponse.json({ data: hit.payload, cached: true });
    }

    const fulfilment =
      body.fulfilment === "delivery" ? "delivery" : "pickup";
    const shops: Coord[] = (body.shops || [])
      .filter(
        (s): s is { lat: number; lng: number } =>
          !!s && Number.isFinite(s.lat) && Number.isFinite(s.lng),
      )
      .map((s) => ({ lat: Number(s.lat), lng: Number(s.lng) }))
      // Drop placeholder/garbage branch coordinates (0,0, seed centre, etc.)
      .filter((s) => checkCoordinate(s.lat, s.lng).ok);

    if (fulfilment === "pickup") {
      if (body.collectMode === "hybrid" && shops.length > 1) {
        const q = quoteHybridConsolidate(
          shops,
          Math.max(0, Number(body.hubIndex) || 0),
        );
        const payload = { ...q, fulfilment };
        quoteCache.set(key, { at: Date.now(), payload });
        return NextResponse.json({ data: payload });
      }
      const q = quoteClassicPickup();
      const payload = { ...q, fulfilment };
      quoteCache.set(key, { at: Date.now(), payload });
      return NextResponse.json({ data: payload });
    }

    if (!drop) {
      const q = await quoteHomeDeliveryLive(
        { lat: Number.NaN, lng: Number.NaN },
        shops,
        {
          zoneId: body.zoneId,
          areaLabel: body.areaLabel,
          heavyRain: false,
        },
      );
      const payload = { ...q, fulfilment, dropFlagged };
      quoteCache.set(key, { at: Date.now(), payload });
      return NextResponse.json({ data: payload });
    }

    const q = await quoteHomeDeliveryLive(drop, shops, {
      zoneId: body.zoneId,
      areaLabel: body.areaLabel,
      heavyRain,
    });
    const payload = { ...q, fulfilment };
    quoteCache.set(key, { at: Date.now(), payload });
    return NextResponse.json({ data: payload });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "quote failed",
        data: {
          deliveryMinor: 20_000,
          distanceKm: 0,
          etaMinutes: 45,
          breakdown: "Standard same-day delivery",
          source: "zone_fallback",
          fulfilment: "delivery",
          baseMajor: 200,
          shopCount: 1,
          adjustments: [],
        },
      },
      { status: 200 },
    );
  }
}
