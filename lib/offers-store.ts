/**
 * Product offers - Supabase-backed.
 */
import type { ProductOffer } from "@/types";
import {
  sbGetOfferByPublicId,
  sbListPublishedOffers,
} from "@/lib/supabase-catalogue";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { majorToMinor } from "./money";

function normalise(o: ProductOffer): ProductOffer {
  const onHand = Math.max(0, Math.round(o.onHand ?? o.stock ?? 0));
  const reserved = Math.max(0, Math.round(o.reserved ?? 0));
  return {
    ...o,
    onHand,
    reserved,
    stock: Math.max(0, onHand - reserved),
    moneyMinor:
      typeof o.moneyMinor === "number"
        ? o.moneyMinor
        : majorToMinor(o.price || 0),
    barcode: o.barcode || o.gtin,
    gtin: o.gtin || o.barcode,
  };
}

export async function listOffers(): Promise<ProductOffer[]> {
  return (await sbListPublishedOffers()).map(normalise);
}

export async function listPublishedOffers(): Promise<ProductOffer[]> {
  return listOffers();
}

export async function listOffersForProduct(
  productId: string,
): Promise<ProductOffer[]> {
  return (await listPublishedOffers()).filter((o) => o.productId === productId);
}

export async function listOffersForVendor(
  vendorId: string,
): Promise<ProductOffer[]> {
  return (await listPublishedOffers()).filter((o) => o.vendorId === vendorId);
}

export async function getOfferById(
  id: string,
  opts?: { includeUnpublished?: boolean },
): Promise<ProductOffer | null> {
  const offer = await sbGetOfferByPublicId(id, opts);
  return offer ? normalise(offer) : null;
}

export async function saveOffers(_offers: ProductOffer[]): Promise<void> {
  throw new Error(
    "saveOffers is retired - mutate offers via Supabase admin / seed script",
  );
}

export async function updateOfferStock(
  offerId: string,
  patch: Partial<Pick<ProductOffer, "onHand" | "reserved">>,
): Promise<ProductOffer | null> {
  const sb = getServiceSupabase();
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.onHand !== undefined) updates.on_hand = patch.onHand;
  if (patch.reserved !== undefined) updates.reserved = patch.reserved;

  const { data, error } = await sb
    .from("product_offers")
    .update(updates)
    .eq("public_id", offerId)
    .select("public_id")
    .maybeSingle();
  if (error || !data) return null;
  return getOfferById(offerId);
}
