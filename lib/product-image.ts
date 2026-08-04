import { productImageUrl } from "@/lib/storage-urls";

/** Safe product image URL for next/image - never empty. */
export const PRODUCT_IMAGE_FALLBACK = productImageUrl("sourdough-loaf.jpeg");

const BROKEN_HOST_FRAGMENTS = [
  "photo-1609091839311-b140b7d37051", // known 404 in seed
];

export function resolveProductImage(src?: string | null): string {
  if (!src || typeof src !== "string") return PRODUCT_IMAGE_FALLBACK;
  const trimmed = src.trim();
  if (!trimmed) return PRODUCT_IMAGE_FALLBACK;
  // Legacy local public paths → Storage
  if (trimmed.startsWith("/products/")) {
    return productImageUrl(trimmed);
  }
  if (BROKEN_HOST_FRAGMENTS.some((f) => trimmed.includes(f))) {
    return PRODUCT_IMAGE_FALLBACK;
  }
  return trimmed;
}
