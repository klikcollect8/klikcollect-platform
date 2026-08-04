/**
 * Clerk-keyed customer cart / wishlist (Supabase).
 */
import { getServiceSupabase } from "@/lib/supabase/admin";

export type CartRow = {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  offer_id?: string;
  updated_at: string;
};

export type WishlistRow = {
  id: string;
  user_id: string;
  product_id: string;
  created_at: string;
};

export type ActivityRow = {
  id: string;
  user_id: string;
  activity_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

async function ensureCart(clerkUserId: string) {
  const sb = getServiceSupabase();
  const { data: existing } = await sb
    .from("carts")
    .select("id")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await sb
    .from("carts")
    .insert({ clerk_user_id: clerkUserId })
    .select("id")
    .single();
  if (error) {
    // Concurrent create — unique clerk_user_id; re-read.
    const { data: raced } = await sb
      .from("carts")
      .select("id")
      .eq("clerk_user_id", clerkUserId)
      .maybeSingle();
    if (raced) return raced.id as string;
    throw error;
  }
  return data.id as string;
}

async function ensureWishlist(clerkUserId: string) {
  const sb = getServiceSupabase();
  const { data: existing } = await sb
    .from("wishlists")
    .select("id")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await sb
    .from("wishlists")
    .insert({ clerk_user_id: clerkUserId })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

function cartLineKey(productPublicId: string, offerPublicId?: string | null) {
  return offerPublicId || productPublicId;
}

export async function listCart(userId: string): Promise<CartRow[]> {
  const sb = getServiceSupabase();
  const cartId = await ensureCart(userId);
  const { data, error } = await sb
    .from("cart_items")
    .select("*")
    .eq("cart_id", cartId);
  if (error) throw error;

  // Collapse any legacy duplicates (null offer_public_id unique gap).
  const byKey = new Map<string, CartRow>();
  for (const r of data || []) {
    const offerId = r.offer_public_id ? String(r.offer_public_id) : undefined;
    const productId = String(r.product_public_id);
    const key = cartLineKey(productId, offerId);
    const prev = byKey.get(key);
    if (prev) {
      prev.quantity += Number(r.quantity) || 0;
      continue;
    }
    byKey.set(key, {
      id: String(r.id),
      user_id: userId,
      product_id: productId,
      quantity: Number(r.quantity) || 0,
      offer_id: offerId,
      updated_at: String(r.updated_at),
    });
  }
  return [...byKey.values()];
}

export async function upsertCartItem(
  userId: string,
  productId: string,
  quantity: number,
  offerId?: string,
): Promise<CartRow> {
  const sb = getServiceSupabase();
  const cartId = await ensureCart(userId);
  const now = new Date().toISOString();

  // Legacy clients stored offer id in product_id with null offer_public_id.
  const lineOfferId =
    offerId || (productId.startsWith("off_") ? productId : undefined);
  const lineProductId = productId;

  if (quantity <= 0) {
    await deleteCartItem(userId, lineOfferId || lineProductId);
    return {
      id: "deleted",
      user_id: userId,
      product_id: lineProductId,
      quantity: 0,
      offer_id: lineOfferId,
      updated_at: now,
    };
  }

  let existingId: string | null = null;

  if (lineOfferId) {
    const { data: byOffer } = await sb
      .from("cart_items")
      .select("id")
      .eq("cart_id", cartId)
      .eq("offer_public_id", lineOfferId)
      .maybeSingle();
    if (byOffer) existingId = byOffer.id;

    if (!existingId) {
      // Legacy rows: offer id parked in product_public_id, offer_public_id null.
      // IMPORTANT: use .is(null) — .eq(null) never matches in PostgREST.
      const { data: legacy } = await sb
        .from("cart_items")
        .select("id")
        .eq("cart_id", cartId)
        .eq("product_public_id", lineOfferId)
        .is("offer_public_id", null)
        .limit(1)
        .maybeSingle();
      if (legacy) existingId = legacy.id;
    }
  } else {
    const { data: byProduct } = await sb
      .from("cart_items")
      .select("id")
      .eq("cart_id", cartId)
      .eq("product_public_id", lineProductId)
      .is("offer_public_id", null)
      .limit(1)
      .maybeSingle();
    if (byProduct) existingId = byProduct.id;
  }

  if (existingId) {
    const { data, error } = await sb
      .from("cart_items")
      .update({
        quantity,
        updated_at: now,
        product_public_id: lineProductId,
        offer_public_id: lineOfferId || null,
      })
      .eq("id", existingId)
      .select("*")
      .single();
    if (error) throw error;
    return {
      id: data.id,
      user_id: userId,
      product_id: data.product_public_id,
      quantity: data.quantity,
      offer_id: data.offer_public_id || undefined,
      updated_at: data.updated_at,
    };
  }

  const { data, error } = await sb
    .from("cart_items")
    .insert({
      cart_id: cartId,
      product_public_id: lineProductId,
      offer_public_id: lineOfferId || null,
      quantity,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) {
    // Unique race — update the winning row.
    if (lineOfferId) {
      const { data: raced } = await sb
        .from("cart_items")
        .select("*")
        .eq("cart_id", cartId)
        .eq("offer_public_id", lineOfferId)
        .maybeSingle();
      if (raced) {
        const { data: updated, error: uErr } = await sb
          .from("cart_items")
          .update({ quantity, updated_at: now })
          .eq("id", raced.id)
          .select("*")
          .single();
        if (uErr) throw uErr;
        return {
          id: updated.id,
          user_id: userId,
          product_id: updated.product_public_id,
          quantity: updated.quantity,
          offer_id: updated.offer_public_id || undefined,
          updated_at: updated.updated_at,
        };
      }
    }
    const { data: racedNull } = await sb
      .from("cart_items")
      .select("*")
      .eq("cart_id", cartId)
      .eq("product_public_id", lineProductId)
      .is("offer_public_id", null)
      .maybeSingle();
    if (racedNull) {
      const { data: updated, error: uErr } = await sb
        .from("cart_items")
        .update({
          quantity,
          updated_at: now,
          offer_public_id: lineOfferId || null,
        })
        .eq("id", racedNull.id)
        .select("*")
        .single();
      if (uErr) throw uErr;
      return {
        id: updated.id,
        user_id: userId,
        product_id: updated.product_public_id,
        quantity: updated.quantity,
        offer_id: updated.offer_public_id || undefined,
        updated_at: updated.updated_at,
      };
    }
    throw error;
  }
  await sb.from("carts").update({ updated_at: now }).eq("id", cartId);
  return {
    id: data.id,
    user_id: userId,
    product_id: data.product_public_id,
    quantity: data.quantity,
    offer_id: data.offer_public_id || undefined,
    updated_at: data.updated_at,
  };
}

export async function clearCart(userId: string) {
  const sb = getServiceSupabase();
  const cartId = await ensureCart(userId);
  await sb.from("cart_items").delete().eq("cart_id", cartId);
}

/** Delete by cart line id, offer public id, or product public id. */
export async function deleteCartItem(userId: string, lineOrProductId: string) {
  const sb = getServiceSupabase();
  const cartId = await ensureCart(userId);
  const { data: byId } = await sb
    .from("cart_items")
    .select("id")
    .eq("cart_id", cartId)
    .eq("id", lineOrProductId)
    .maybeSingle();
  if (byId) {
    await sb.from("cart_items").delete().eq("id", byId.id);
    return;
  }
  await sb
    .from("cart_items")
    .delete()
    .eq("cart_id", cartId)
    .or(
      `offer_public_id.eq.${lineOrProductId},product_public_id.eq.${lineOrProductId}`,
    );
}

export async function listWishlist(userId: string): Promise<WishlistRow[]> {
  const sb = getServiceSupabase();
  const wishlistId = await ensureWishlist(userId);
  const { data, error } = await sb
    .from("wishlist_items")
    .select("*")
    .eq("wishlist_id", wishlistId);
  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.id,
    user_id: userId,
    product_id: r.product_public_id,
    created_at: r.created_at,
  }));
}

export async function addWishlist(
  userId: string,
  productId: string,
): Promise<WishlistRow> {
  return addWishlistItem(userId, productId);
}

export async function removeWishlist(userId: string, productId: string) {
  return removeWishlistItem(userId, productId);
}

export async function addWishlistItem(
  userId: string,
  productId: string,
): Promise<WishlistRow> {
  const sb = getServiceSupabase();
  const wishlistId = await ensureWishlist(userId);
  const { data: existing } = await sb
    .from("wishlist_items")
    .select("*")
    .eq("wishlist_id", wishlistId)
    .eq("product_public_id", productId)
    .maybeSingle();
  if (existing) {
    return {
      id: existing.id,
      user_id: userId,
      product_id: existing.product_public_id,
      created_at: existing.created_at,
    };
  }
  const { data, error } = await sb
    .from("wishlist_items")
    .insert({ wishlist_id: wishlistId, product_public_id: productId })
    .select("*")
    .single();
  if (error) throw error;
  return {
    id: data.id,
    user_id: userId,
    product_id: data.product_public_id,
    created_at: data.created_at,
  };
}

export async function removeWishlistItem(userId: string, productId: string) {
  const sb = getServiceSupabase();
  const wishlistId = await ensureWishlist(userId);
  await sb
    .from("wishlist_items")
    .delete()
    .eq("wishlist_id", wishlistId)
    .eq("product_public_id", productId);
}

export async function recordActivity(
  userId: string,
  activityType: string,
  metadata: Record<string, unknown> = {},
): Promise<ActivityRow> {
  const sb = getServiceSupabase();
  const { data } = await sb
    .from("behavioural_events")
    .insert({
      event_name: activityType,
      subject_key: userId,
      properties: metadata,
    })
    .select("id, created_at")
    .single();
  return {
    id: String(data?.id ?? `act_${Date.now()}`),
    user_id: userId,
    activity_type: activityType,
    metadata,
    created_at: String(data?.created_at ?? new Date().toISOString()),
  };
}

export async function appendActivity(
  userId: string,
  activityType: string,
  metadata: Record<string, unknown> = {},
) {
  return recordActivity(userId, activityType, metadata);
}

export async function listActivity(userId: string): Promise<ActivityRow[]> {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("behavioural_events")
    .select("id, event_name, properties, created_at")
    .eq("subject_key", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data || []).map((r) => ({
    id: String(r.id),
    user_id: userId,
    activity_type: r.event_name,
    metadata: (r.properties || {}) as Record<string, unknown>,
    created_at: r.created_at,
  }));
}
