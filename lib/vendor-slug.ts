/** URL-safe vendor slug */
export function slugifyVendorName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Prefer explicit id slug when shaped as ven_*, else slugify name */
export function resolveVendorSlug(opts: {
  id?: string;
  name: string;
}): string {
  if (opts.id?.startsWith("ven_")) {
    return opts.id.replace(/^ven_/, "").replace(/_/g, "-");
  }
  return slugifyVendorName(opts.name);
}
