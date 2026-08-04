import { NextRequest, NextResponse } from "next/server";
import { requireVendorPermission } from "@/lib/auth/require-vendor";
import { inVendorScope } from "@/lib/auth/vendor-scope";
import { getServiceSupabase } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const vendorId = request.nextUrl.searchParams.get("vendorId") || undefined;
  const storePublicId =
    request.nextUrl.searchParams.get("storeId") || undefined;
  const gate = await requireVendorPermission("vendor:settings", { vendorId });
  if (!gate.ok) return gate.response;

  const scope = vendorId || gate.actor.vendorIds[0];
  if (!scope || !inVendorScope(gate.actor, scope)) {
    return NextResponse.json({ data: [] });
  }

  const sb = getServiceSupabase();
  let q = sb
    .from("store_hours")
    .select("*")
    .eq("vendor_public_id", scope)
    .order("day_of_week", { ascending: true });
  if (storePublicId) q = q.eq("store_public_id", storePublicId);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json(
      { error: { message: error.message } },
      { status: 500 },
    );
  }
  return NextResponse.json({ data: data || [] });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const vendorId = String(body?.vendorId || "");
  const storePublicId = String(body?.storeId || "");
  const gate = await requireVendorPermission("vendor:settings", { vendorId });
  if (!gate.ok) return gate.response;
  if (!inVendorScope(gate.actor, vendorId) || !storePublicId) {
    return NextResponse.json(
      { error: { message: "vendorId and storeId required" } },
      { status: 400 },
    );
  }

  const weekly = Array.isArray(body?.weekly) ? body.weekly : [];
  const holidays = Array.isArray(body?.holidays) ? body.holidays : [];
  const sb = getServiceSupabase();

  await sb
    .from("store_hours")
    .delete()
    .eq("vendor_public_id", vendorId)
    .eq("store_public_id", storePublicId);

  const rows = [
    ...weekly.map(
      (d: {
        dayOfWeek: number;
        openTime?: string | null;
        closeTime?: string | null;
        isClosed?: boolean;
      }) => ({
        store_public_id: storePublicId,
        vendor_public_id: vendorId,
        day_of_week: Number(d.dayOfWeek),
        open_time: d.isClosed ? null : d.openTime || "09:00",
        close_time: d.isClosed ? null : d.closeTime || "18:00",
        is_closed: !!d.isClosed,
        holiday_date: null,
        holiday_label: null,
      }),
    ),
    ...holidays.map(
      (h: {
        date: string;
        label?: string;
        openTime?: string | null;
        closeTime?: string | null;
        isClosed?: boolean;
      }) => ({
        store_public_id: storePublicId,
        vendor_public_id: vendorId,
        day_of_week: null,
        open_time: h.isClosed ? null : h.openTime || null,
        close_time: h.isClosed ? null : h.closeTime || null,
        is_closed: h.isClosed !== false,
        holiday_date: h.date,
        holiday_label: h.label || "Holiday",
      }),
    ),
  ];

  if (rows.length) {
    const { error } = await sb.from("store_hours").insert(rows);
    if (error) {
      return NextResponse.json(
        { error: { message: error.message } },
        { status: 500 },
      );
    }
  }

  const { data } = await sb
    .from("store_hours")
    .select("*")
    .eq("vendor_public_id", vendorId)
    .eq("store_public_id", storePublicId);

  return NextResponse.json({ data: data || [] });
}
