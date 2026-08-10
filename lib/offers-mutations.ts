/**
 * Vendor offer mutations — price / stock / availability.
 * Always scoped by vendor public id from the actor, never from the client alone.
 */
import { getServiceSupabase } from "@/lib/supabase/admin";
import { getOfferById, updateOfferStock } from "@/lib/offers-store";
import { majorToMinor, minorToMajor } from "@/lib/money";
import type { ProductOffer } from "@/types";
import { adjustOnHand } from "@/lib/inventory";
import { publicId } from "@/lib/ids";

/** Postgres undefined_table / missing relation (migration not applied yet). */
export function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string; details?: string };
  if (e.code === "42P01" || e.code === "PGRST205") return true;
  const msg = `${e.message || ""} ${e.details || ""}`.toLowerCase();
  return (
    msg.includes("does not exist") ||
    msg.includes("could not find the table") ||
    msg.includes("schema cache")
  );
}

export class FeatureUnavailableError extends Error {
  code = "FEATURE_UNAVAILABLE" as const;
  constructor(message: string) {
    super(message);
    this.name = "FeatureUnavailableError";
  }
}

export async function updateOfferPrice(input: {
  offerPublicId: string;
  vendorPublicId: string;
  actorClerkId: string;
  priceMajor: number;
  reason?: string;
}): Promise<ProductOffer | null> {
  const offer = await getOfferById(input.offerPublicId, {
    includeUnpublished: true,
  });
  if (!offer || offer.vendorId !== input.vendorPublicId) return null;

  const newMinor = majorToMinor(input.priceMajor);
  if (!Number.isInteger(input.priceMajor) || newMinor < 0) return null;

  const oldMinor = offer.moneyMinor ?? majorToMinor(offer.price || 0);
  const sb = getServiceSupabase();

  const { data: row } = await sb
    .from("product_offers")
    .select("id")
    .eq("public_id", input.offerPublicId)
    .maybeSingle();
  if (!row) return null;

  const { error } = await sb
    .from("product_offers")
    .update({
      price_minor: newMinor,
      updated_at: new Date().toISOString(),
    })
    .eq("public_id", input.offerPublicId);
  if (error) throw error;

  const { error: histErr } = await sb.from("offer_price_changes").insert({
    offer_id: row.id,
    offer_public_id: input.offerPublicId,
    vendor_public_id: input.vendorPublicId,
    actor_clerk_id: input.actorClerkId,
    old_price_minor: oldMinor,
    new_price_minor: newMinor,
    reason: input.reason || "vendor_price_update",
  });
  if (histErr) {
    if (isMissingRelationError(histErr)) {
      console.warn(
        "[offers] offer_price_changes missing — price write succeeded without history",
        histErr.message,
      );
    } else {
      console.warn("[offers] price history insert failed", histErr.message);
    }
  }

  return getOfferById(input.offerPublicId, { includeUnpublished: true });
}

export async function updateOfferAvailability(input: {
  offerPublicId: string;
  vendorPublicId: string;
  status: "published" | "draft" | "archived";
}): Promise<ProductOffer | null> {
  const offer = await getOfferById(input.offerPublicId, {
    includeUnpublished: true,
  });
  if (!offer || offer.vendorId !== input.vendorPublicId) return null;

  const sb = getServiceSupabase();
  const { error } = await sb
    .from("product_offers")
    .update({
      status: input.status,
      updated_at: new Date().toISOString(),
    })
    .eq("public_id", input.offerPublicId);
  if (error) throw error;
  return getOfferById(input.offerPublicId, { includeUnpublished: true });
}

export async function setOfferStock(input: {
  offerPublicId: string;
  vendorPublicId: string;
  actorClerkId: string;
  onHand: number;
  reason?: string;
}): Promise<ProductOffer | null> {
  const offer = await getOfferById(input.offerPublicId, {
    includeUnpublished: true,
  });
  if (!offer || offer.vendorId !== input.vendorPublicId) return null;

  await adjustOnHand({
    productId: input.offerPublicId,
    onHand: input.onHand,
    actorUserId: input.actorClerkId,
    reason: input.reason || "adjust",
  });

  return updateOfferStock(input.offerPublicId, { onHand: input.onHand });
}

export async function createCatalogueCorrection(input: {
  productPublicId: string;
  offerPublicId?: string;
  vendorPublicId: string;
  actorClerkId: string;
  fields: Record<string, string>;
  message: string;
}): Promise<{ publicId: string }> {
  const sb = getServiceSupabase();
  const id = publicId("ccr");
  const { error } = await sb.from("catalogue_correction_requests").insert({
    public_id: id,
    product_public_id: input.productPublicId,
    offer_public_id: input.offerPublicId || null,
    vendor_public_id: input.vendorPublicId,
    actor_clerk_id: input.actorClerkId,
    fields: input.fields,
    message: input.message,
    status: "open",
  });
  if (error) {
    if (isMissingRelationError(error)) {
      throw new FeatureUnavailableError(
        "Catalogue corrections are not available yet (migration pending)",
      );
    }
    throw error;
  }
  return { publicId: id };
}

export async function listCatalogueCorrections(opts?: {
  status?: string;
  vendorPublicId?: string;
  limit?: number;
}) {
  const sb = getServiceSupabase();
  let q = sb
    .from("catalogue_correction_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 100);
  if (opts?.status) q = q.eq("status", opts.status);
  if (opts?.vendorPublicId) q = q.eq("vendor_public_id", opts.vendorPublicId);
  const { data, error } = await q;
  if (error) {
    if (isMissingRelationError(error)) {
      throw new FeatureUnavailableError(
        "Catalogue corrections are not available yet (migration pending)",
      );
    }
    throw error;
  }
  return data || [];
}

export { minorToMajor };
