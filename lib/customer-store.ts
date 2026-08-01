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
  if (error) throw error;
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

export async function listCart(userId: string): Promise<CartRow[]> {
  const sb = getServiceSupabase();
  const cartId = await ensureCart(userId);
  const { data, error } = await sb
    .from("cart_items")
    .select("*")
    .eq("cart_id", cartId);
  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.id,
    user_id: userId,
    product_id: r.product_public_id,
    quantity: r.quantity,
    offer_id: r.offer_public_id || undefined,
    updated_at: r.updated_at,
  }));
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

  if (quantity <= 0) {
    await sb
      .from("cart_items")
      .delete()
      .eq("cart_id", cartId)
      .eq("product_public_id", productId)
      .eq("offer_public_id", offerId || null);
    return {
      id: "deleted",
      user_id: userId,
      product_id: productId,
      quantity: 0,
      offer_id: offerId,
      updated_at: now,
    };
  }

  const { data: existing } = await sb
    .from("cart_items")
    .select("id")
    .eq("cart_id", cartId)
    .eq("product_public_id", productId)
    .eq("offer_public_id", offerId ?? null)
    .maybeSingle();

  if (existing) {
    const { data, error } = await sb
      .from("cart_items")
      .update({ quantity, updated_at: now })
      .eq("id", existing.id)
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
      product_public_id: productId,
      offer_public_id: offerId || null,
      quantity,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) throw error;
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
