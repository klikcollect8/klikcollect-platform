import { getServiceSupabase } from "@/lib/supabase/admin";

export type VendorActivityKind =
  | "order"
  | "payment"
  | "driver"
  | "review"
  | "stock"
  | "pos"
  | "system";

export type VendorActivityEvent = {
  id: number;
  vendorPublicId: string;
  kind: VendorActivityKind | string;
  title: string;
  body?: string | null;
  refType?: string | null;
  refId?: string | null;
  meta?: Record<string, unknown>;
  createdAt: string;
};

export async function emitVendorActivity(input: {
  vendorPublicId: string;
  kind: VendorActivityKind | string;
  title: string;
  body?: string;
  refType?: string;
  refId?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  if (!input.vendorPublicId) return;
  const sb = getServiceSupabase();
  await sb.from("vendor_activity_events").insert({
    vendor_public_id: input.vendorPublicId,
    kind: input.kind,
    title: input.title,
    body: input.body ?? null,
    ref_type: input.refType ?? null,
    ref_id: input.refId ?? null,
    meta: input.meta ?? {},
  });
}

export async function listVendorActivity(
  vendorPublicIds: string[],
  limit = 40,
): Promise<VendorActivityEvent[]> {
  if (!vendorPublicIds.length) return [];
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("vendor_activity_events")
    .select("*")
    .in("vendor_public_id", vendorPublicIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((r) => ({
    id: Number(r.id),
    vendorPublicId: String(r.vendor_public_id),
    kind: String(r.kind),
    title: String(r.title),
    body: r.body,
    refType: r.ref_type,
    refId: r.ref_id,
    meta: (r.meta || {}) as Record<string, unknown>,
    createdAt: r.created_at,
  }));
}
