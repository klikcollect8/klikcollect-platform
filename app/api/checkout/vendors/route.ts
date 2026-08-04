import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/admin";
import {
  getPublicVendorHours,
  getPublicVendorLocations,
} from "@/lib/vendor-storefront";

/**
 * Batch vendor details for checkout (locations + hours) by public ids.
 * POST { vendorIds: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const raw: unknown[] = Array.isArray(body?.vendorIds)
      ? body.vendorIds
      : [];
    const vendorIds: string[] = [
      ...new Set(
        raw
          .map((id) => String(id ?? "").trim())
          .filter((id): id is string => id.length > 0),
      ),
    ].slice(0, 20);

    if (!vendorIds.length) {
      return NextResponse.json({ data: [] });
    }

    const sb = getServiceSupabase();
    const { data: vendors } = await sb
      .from("vendors")
      .select("public_id, name, neighbourhood, address_text, city")
      .in("public_id", vendorIds);

    const byId = new Map(
      (vendors || []).map((v) => [String(v.public_id), v]),
    );

    const data = await Promise.all(
      vendorIds.map(async (id) => {
        const row = byId.get(id);
        const [locations, hours] = await Promise.all([
          getPublicVendorLocations(id),
          getPublicVendorHours(id),
        ]);
        const primary =
          locations.find((l) => l.isPrimary) || locations[0] || null;
        const primaryHours =
          hours.find((h) => h.storePublicId === primary?.publicId) ||
          hours[0] ||
          null;

        return {
          vendorId: id,
          name: row?.name ? String(row.name) : id,
          neighbourhood:
            primary?.neighbourhood ||
            (row?.neighbourhood ? String(row.neighbourhood) : null),
          address:
            primary?.address ||
            (row?.address_text ? String(row.address_text) : null),
          city: row?.city ? String(row.city) : null,
          phone: primary?.phone || null,
          lat: primary?.lat ?? null,
          lng: primary?.lng ?? null,
          storeName: primary?.name || null,
          openNow: primaryHours?.openNow ?? false,
          todayLabel: primaryHours?.todayLabel || "Hours unavailable",
          weekly: primaryHours?.weekly || [],
          holidays: primaryHours?.holidays || [],
        };
      }),
    );

    return NextResponse.json({ data });
  } catch (error) {
    console.error("POST /api/checkout/vendors", error);
    return NextResponse.json(
      { error: { code: "SERVER", message: "Failed to load vendors" } },
      { status: 500 },
    );
  }
}
