import { getServiceSupabase } from "@/lib/supabase/admin";
import { publicId } from "@/lib/ids";

export type VendorCustomer = {
  id: string;
  publicId: string;
  vendorPublicId: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  notes: string | null;
  tags: string[];
  loyaltyPoints: number;
  storeCreditMinor: number;
  orderCount: number;
  totalSpentMinor: number;
  lastOrderAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapRow(r: Record<string, unknown>): VendorCustomer {
  return {
    id: String(r.id),
    publicId: String(r.public_id),
    vendorPublicId: String(r.vendor_public_id),
    email: r.email ? String(r.email) : null,
    phone: r.phone ? String(r.phone) : null,
    name: r.name ? String(r.name) : null,
    notes: r.notes ? String(r.notes) : null,
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    loyaltyPoints: Number(r.loyalty_points || 0),
    storeCreditMinor: Number(r.store_credit_minor || 0),
    orderCount: Number(r.order_count || 0),
    totalSpentMinor: Number(r.total_spent_minor || 0),
    lastOrderAt: r.last_order_at ? String(r.last_order_at) : null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

/** Upsert CRM row on order/payment - keyed by vendor + email or phone. */
export async function upsertVendorCustomerFromOrder(input: {
  vendorPublicId: string;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  totalMinor?: number;
  orderedAt?: string;
}): Promise<VendorCustomer | null> {
  const email = input.email?.trim().toLowerCase() || null;
  const phone = input.phone?.trim() || null;
  if (!input.vendorPublicId || (!email && !phone)) return null;

  const sb = getServiceSupabase();
  let existing: Record<string, unknown> | null = null;

  if (email) {
    const { data } = await sb
      .from("vendor_customers")
      .select("*")
      .eq("vendor_public_id", input.vendorPublicId)
      .ilike("email", email)
      .maybeSingle();
    existing = data;
  }
  if (!existing && phone) {
    const { data } = await sb
      .from("vendor_customers")
      .select("*")
      .eq("vendor_public_id", input.vendorPublicId)
      .eq("phone", phone)
      .maybeSingle();
    existing = data;
  }

  const now = input.orderedAt || new Date().toISOString();
  const spend = Math.max(0, Number(input.totalMinor || 0));

  if (existing) {
    const { data, error } = await sb
      .from("vendor_customers")
      .update({
        name: input.name || existing.name,
        email: email || existing.email,
        phone: phone || existing.phone,
        order_count: Number(existing.order_count || 0) + 1,
        total_spent_minor: Number(existing.total_spent_minor || 0) + spend,
        last_order_at: now,
        updated_at: now,
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error || !data) return null;
    return mapRow(data);
  }

  const { data, error } = await sb
    .from("vendor_customers")
    .insert({
      public_id: publicId("vcust"),
      vendor_public_id: input.vendorPublicId,
      email,
      phone,
      name: input.name || null,
      order_count: 1,
      total_spent_minor: spend,
      last_order_at: now,
    })
    .select("*")
    .single();
  if (error || !data) return null;
  return mapRow(data);
}

export async function listVendorCustomers(
  vendorPublicIds: string[],
): Promise<VendorCustomer[]> {
  if (!vendorPublicIds.length) return [];
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("vendor_customers")
    .select("*")
    .in("vendor_public_id", vendorPublicIds)
    .order("last_order_at", { ascending: false, nullsFirst: false });
  if (error || !data) return [];
  return data.map((r) => mapRow(r));
}

export function customerSegment(
  c: Pick<VendorCustomer, "orderCount" | "totalSpentMinor" | "lastOrderAt">,
): "VIP" | "Regular" | "New" | "Inactive" {
  const days = c.lastOrderAt
    ? (Date.now() - new Date(c.lastOrderAt).getTime()) / 86400000
    : 999;
  if (days > 60) return "Inactive";
  if (c.orderCount <= 1) return "New";
  if (c.totalSpentMinor >= 5_000_000 || c.orderCount >= 8) return "VIP";
  return "Regular";
}
