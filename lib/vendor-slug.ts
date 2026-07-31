import { FOUNDING_VENDORS } from "@/lib/founding-vendors";

/** URL-safe vendor slug */
export function slugifyVendorName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Prefer founding-vendor slug when the name/id matches */
export function resolveVendorSlug(opts: {
  id?: string;
  name: string;
}): string {
  const byId = opts.id
    ? FOUNDING_VENDORS.find((v) => v.id === opts.id)
    : undefined;
  if (byId) return byId.slug;
  const byName = FOUNDING_VENDORS.find(
    (v) => v.name.toLowerCase() === opts.name.trim().toLowerCase(),
  );
  if (byName) return byName.slug;
  return slugifyVendorName(opts.name);
}
