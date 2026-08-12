import { getServiceSupabase } from "@/lib/supabase/admin";

const ALLOWED_HOSTS = [
  "images.openfoodfacts.org",
  "static.openfoodfacts.org",
  "world.openfoodfacts.org",
  "images.openproductsfacts.org",
  "static.openproductsfacts.org",
  "world.openproductsfacts.org",
];

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function isAllowedExternalImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    return ALLOWED_HOSTS.some(
      (h) => u.hostname === h || u.hostname.endsWith(`.${h}`),
    );
  } catch {
    return false;
  }
}

/**
 * Download an allowlisted external image into product-images storage.
 * Returns public URL or null on failure.
 */
export async function importExternalProductImage(
  sourceUrl: string,
): Promise<{ url: string; originalUrl: string } | null> {
  if (!isAllowedExternalImageUrl(sourceUrl)) return null;
  try {
    const res = await fetch(sourceUrl, {
      headers: {
        "User-Agent":
          process.env.KLIKCOLLECT_PRODUCT_RESOLVER_USER_AGENT ||
          "KlikCollect/0.1.0 (catalogue-image-import)",
        Accept: "image/*",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") || "").split(";")[0].trim();
    if (!ALLOWED_TYPES.has(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > MAX_BYTES) return null;

    const ext =
      type === "image/png"
        ? "png"
        : type === "image/webp"
          ? "webp"
          : type === "image/gif"
            ? "gif"
            : "jpg";
    const path = `products/import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const sb = getServiceSupabase();
    const { error } = await sb.storage
      .from("product-images")
      .upload(path, buf, { contentType: type, upsert: false });
    if (error) {
      console.error("[importExternalProductImage]", error);
      return null;
    }
    const { data } = sb.storage.from("product-images").getPublicUrl(path);
    return { url: data.publicUrl, originalUrl: sourceUrl };
  } catch (err) {
    console.error("[importExternalProductImage]", err);
    return null;
  }
}
