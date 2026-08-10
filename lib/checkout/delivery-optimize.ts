import { listOffersForProduct } from "@/lib/offers-store";
import { filterAvailableOffers } from "@/lib/offers/rank-offers";
import { sbGetVendorStorefrontProducts } from "@/lib/supabase-catalogue";
import {
  DELIVERY_STOP_FEE_MAJOR,
  quoteHomeDelivery,
  quoteHomeDeliveryLive,
  type Coord,
  type DeliveryQuote,
} from "@/lib/checkout/delivery-pricing";
import { getPublicVendorLocations } from "@/lib/vendor-storefront";
import type { ProductOffer } from "@/types";

export type OptimizeCartLine = {
  productId: string;
  productName?: string;
  offerId: string;
  vendorId: string;
  vendorName?: string;
  offerPrice: number;
};

export type DeliverySuggestion =
  | {
      kind: "switch_vendor";
      message: string;
      saveMajor: number;
      lineOfferId: string;
      productId: string;
      newOffer: {
        offerId: string;
        offerPrice: number;
        vendorId: string;
        vendorName: string;
        neighbourhood?: string;
      };
    }
  | {
      kind: "avoid_stop";
      message: string;
      saveMajor: number;
      productId: string;
      productName: string;
      offerId: string;
      offerPrice: number;
      vendorId: string;
      vendorName: string;
      neighbourhood?: string;
      image?: string;
    };

const MIN_SAVE_MAJOR = 50;

async function vendorCoord(vendorId: string): Promise<Coord | null> {
  try {
    const locs = await getPublicVendorLocations(vendorId);
    const primary = locs.find((l) => l.isPrimary) || locs[0];
    if (
      primary?.lat != null &&
      primary?.lng != null &&
      Number.isFinite(primary.lat) &&
      Number.isFinite(primary.lng)
    ) {
      return { lat: primary.lat, lng: primary.lng };
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function shopsForVendors(
  vendorIds: string[],
  offerHints: ProductOffer[] = [],
): Promise<Coord[]> {
  const coords: Coord[] = [];
  const seen = new Set<string>();
  for (const o of offerHints) {
    if (!o.vendorId || seen.has(o.vendorId)) continue;
    if (o.lat != null && o.lng != null && Number.isFinite(o.lat) && Number.isFinite(o.lng)) {
      coords.push({ lat: o.lat, lng: o.lng });
      seen.add(o.vendorId);
    }
  }
  await Promise.all(
    vendorIds.map(async (id) => {
      if (seen.has(id)) return;
      const c = await vendorCoord(id);
      if (c) {
        coords.push(c);
        seen.add(id);
      }
    }),
  );
  return coords;
}

function feeMajor(q: DeliveryQuote): number {
  return q.deliveryMinor / 100;
}

export async function findDeliverySuggestions(opts: {
  lines: OptimizeCartLine[];
  drop: Coord | null;
  areaLabel?: string | null;
}): Promise<{ currentQuote: DeliveryQuote | null; suggestions: DeliverySuggestion[] }> {
  const lines = opts.lines.filter((l) => l.productId && l.offerId && l.vendorId);
  if (!lines.length || !opts.drop) return { currentQuote: null, suggestions: [] };

  const vendorIds = [...new Set(lines.map((l) => l.vendorId))];
  const shopCoords = await shopsForVendors(vendorIds);
  if (!shopCoords.length) return { currentQuote: null, suggestions: [] };

  const currentQuote = await quoteHomeDeliveryLive(opts.drop, shopCoords, {
    areaLabel: opts.areaLabel,
  });
  const currentFee = feeMajor(currentQuote);
  const suggestions: DeliverySuggestion[] = [];

  type SwitchCandidate = { line: OptimizeCartLine; alt: ProductOffer; save: number };
  const switchCandidates: SwitchCandidate[] = [];

  for (const line of lines) {
    const alts = filterAvailableOffers(await listOffersForProduct(line.productId)).filter(
      (o) => o.id !== line.offerId && o.vendorId !== line.vendorId,
    );
    const ranked = alts
      .map((o) => {
        const d =
          o.lat != null && o.lng != null
            ? Math.hypot(o.lat - opts.drop!.lat, o.lng - opts.drop!.lng)
            : 999;
        return { o, d };
      })
      .sort((a, b) => a.d - b.d || a.o.price - b.o.price)
      .slice(0, 4)
      .map((x) => x.o);

    for (const alt of ranked) {
      if (alt.price > line.offerPrice * 1.05) continue;
      const nextVendorIds = [
        ...new Set(lines.map((l) => (l.offerId === line.offerId ? alt.vendorId : l.vendorId))),
      ];
      const nextShops = await shopsForVendors(nextVendorIds, [alt]);
      if (!nextShops.length) continue;
      const sim = quoteHomeDelivery(opts.drop, nextShops);
      const save = Math.round(currentFee - feeMajor(sim));
      if (save >= MIN_SAVE_MAJOR) switchCandidates.push({ line, alt, save });
    }
  }

  switchCandidates.sort((a, b) => b.save - a.save);
  const bestSwitch = switchCandidates[0];
  if (bestSwitch) {
    const nextVendorIds = [
      ...new Set(
        lines.map((l) =>
          l.offerId === bestSwitch.line.offerId ? bestSwitch.alt.vendorId : l.vendorId,
        ),
      ),
    ];
    const nextShops = await shopsForVendors(nextVendorIds, [bestSwitch.alt]);
    const live = await quoteHomeDeliveryLive(opts.drop, nextShops, { areaLabel: opts.areaLabel });
    const save = Math.round(currentFee - feeMajor(live));
    if (save >= MIN_SAVE_MAJOR) {
      suggestions.push({
        kind: "switch_vendor",
        message: `Buy from ${bestSwitch.alt.vendorName || "another shop"} instead. Save KES ${save} on delivery.`,
        saveMajor: save,
        lineOfferId: bestSwitch.line.offerId,
        productId: bestSwitch.line.productId,
        newOffer: {
          offerId: bestSwitch.alt.id,
          offerPrice: bestSwitch.alt.price,
          vendorId: bestSwitch.alt.vendorId,
          vendorName: bestSwitch.alt.vendorName,
          neighbourhood: bestSwitch.alt.neighbourhood,
        },
      });
    }
  }

  if (suggestions.length < 2) {
    const productIdsInBag = new Set(lines.map((l) => l.productId));
    for (const vid of vendorIds.slice(0, 3)) {
      if (suggestions.length >= 2) break;
      try {
        const catalog = await sbGetVendorStorefrontProducts(vid);
        const pick = catalog.find(
          (p) => p.stock > 0 && !productIdsInBag.has(p.id) && Number(p.price) > 0,
        );
        if (!pick) continue;
        suggestions.push({
          kind: "avoid_stop",
          message: `This nearby vendor also has ${pick.name}. Add it here and avoid an extra stop fee.`,
          saveMajor: DELIVERY_STOP_FEE_MAJOR,
          productId: pick.id,
          productName: pick.name,
          offerId: pick.offerId,
          offerPrice: pick.price,
          vendorId: pick.vendorId || vid,
          vendorName:
            pick.vendorName ||
            lines.find((l) => l.vendorId === vid)?.vendorName ||
            "this shop",
          neighbourhood: pick.neighbourhood,
          image: pick.image,
        });
      } catch {
        /* skip */
      }
    }
  }

  return { currentQuote, suggestions: suggestions.slice(0, 2) };
}
