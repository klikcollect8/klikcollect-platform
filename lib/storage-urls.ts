/**
 * Public Supabase Storage URL helpers (client + server safe).
 * Images live in Storage; local files are seed-only under scripts/seed-assets.
 */

function supabaseOrigin(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
}

export function storagePublicUrl(bucket: string, objectPath: string): string {
  const base = supabaseOrigin();
  const clean = objectPath.replace(/^\//, "");
  if (!base) return `/${clean}`;
  return `${base}/storage/v1/object/public/${bucket}/${clean}`;
}

export function productImageUrl(fileName: string): string {
  return storagePublicUrl("product-images", pathBasename(fileName));
}

export function categoryImageUrl(fileName: string): string {
  return storagePublicUrl("category-images", pathBasename(fileName));
}

export function cmsImageUrl(objectPath: string): string {
  return storagePublicUrl("cms-images", objectPath.replace(/^\//, ""));
}

function pathBasename(fileOrPath: string): string {
  const cleaned = fileOrPath.replace(/\\/g, "/");
  const parts = cleaned.split("/");
  return parts[parts.length - 1] || cleaned;
}
