/**
 * Clerk-keyed customer cart / wishlist (Phase A).
 * Replaces Supabase Auth UUID scoping until clerk_identities + RLS land.
 */
import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");

export type CartRow = {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
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

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, file), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, data: unknown) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, file), JSON.stringify(data, null, 2), "utf8");
}

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
}

export async function listCart(userId: string): Promise<CartRow[]> {
  const all = await readJson<CartRow[]>("user-carts.json", []);
  return all.filter((r) => r.user_id === userId);
}

export async function upsertCartItem(
  userId: string,
  productId: string,
  quantity: number,
): Promise<CartRow> {
  const all = await readJson<CartRow[]>("user-carts.json", []);
  const idx = all.findIndex(
    (r) => r.user_id === userId && r.product_id === productId,
  );
  const now = new Date().toISOString();
  if (quantity <= 0) {
    if (idx >= 0) {
      all.splice(idx, 1);
      await writeJson("user-carts.json", all);
    }
    return {
      id: "deleted",
      user_id: userId,
      product_id: productId,
      quantity: 0,
      updated_at: now,
    };
  }
  if (idx >= 0) {
    all[idx] = { ...all[idx], quantity, updated_at: now };
    await writeJson("user-carts.json", all);
    return all[idx];
  }
  const row: CartRow = {
    id: id("cart"),
    user_id: userId,
    product_id: productId,
    quantity,
    updated_at: now,
  };
  all.push(row);
  await writeJson("user-carts.json", all);
  return row;
}

export async function deleteCartItem(userId: string, productId: string) {
  const all = await readJson<CartRow[]>("user-carts.json", []);
  await writeJson(
    "user-carts.json",
    all.filter((r) => !(r.user_id === userId && r.product_id === productId)),
  );
}

export async function listWishlist(userId: string): Promise<WishlistRow[]> {
  const all = await readJson<WishlistRow[]>("user-wishlists.json", []);
  return all.filter((r) => r.user_id === userId);
}

export async function addWishlist(
  userId: string,
  productId: string,
): Promise<WishlistRow> {
  const all = await readJson<WishlistRow[]>("user-wishlists.json", []);
  const existing = all.find(
    (r) => r.user_id === userId && r.product_id === productId,
  );
  if (existing) return existing;
  const row: WishlistRow = {
    id: id("wish"),
    user_id: userId,
    product_id: productId,
    created_at: new Date().toISOString(),
  };
  all.push(row);
  await writeJson("user-wishlists.json", all);
  return row;
}

export async function removeWishlist(userId: string, productId: string) {
  const all = await readJson<WishlistRow[]>("user-wishlists.json", []);
  await writeJson(
    "user-wishlists.json",
    all.filter((r) => !(r.user_id === userId && r.product_id === productId)),
  );
}

export async function appendActivity(
  userId: string,
  activityType: string,
  metadata: Record<string, unknown> = {},
): Promise<ActivityRow> {
  const all = await readJson<ActivityRow[]>("user-activity.json", []);
  const row: ActivityRow = {
    id: id("act"),
    user_id: userId,
    activity_type: activityType,
    metadata,
    created_at: new Date().toISOString(),
  };
  all.unshift(row);
  await writeJson("user-activity.json", all.slice(0, 200));
  return row;
}

export async function listActivity(userId: string): Promise<ActivityRow[]> {
  const all = await readJson<ActivityRow[]>("user-activity.json", []);
  return all.filter((r) => r.user_id === userId);
}
