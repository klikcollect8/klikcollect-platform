import type { VendorActor } from "@/lib/auth/require-vendor";

/**
 * Vendor OS APIs are tenant-scoped only.
 * Platform staff must use /api/admin/* for cross-vendor ops - no god-mode on /api/os/*.
 */
export function vendorScopeIds(actor: VendorActor): string[] {
  return actor.vendorIds.filter(Boolean);
}

export function inVendorScope(
  actor: VendorActor,
  vendorId: string | null | undefined,
): boolean {
  if (!vendorId) return false;
  return vendorScopeIds(actor).includes(vendorId);
}

export function filterByVendorIds<T>(
  rows: T[],
  actor: VendorActor,
  getVendorIds: (row: T) => string[],
): T[] {
  const allowed = new Set(vendorScopeIds(actor));
  if (!allowed.size) return [];
  return rows.filter((row) => getVendorIds(row).some((id) => allowed.has(id)));
}
