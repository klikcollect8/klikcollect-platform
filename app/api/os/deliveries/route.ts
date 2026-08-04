import { NextRequest, NextResponse } from "next/server";
import { requireVendorPermission } from "@/lib/auth/require-vendor";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { publicId } from "@/lib/ids";
import { emitVendorActivity } from "@/lib/vendor-activity";
import { notifyVendorStaff } from "@/lib/vendor-notifications";

export async function GET(request: NextRequest) {
  const vendorId = request.nextUrl.searchParams.get("vendorId") || undefined;
  const gate = await requireVendorPermission("delivery:view", { vendorId });
  if (!gate.ok) return gate.response;

  if (!gate.actor.vendorIds.length) {
    return NextResponse.json({ data: [], driver_locations: [] });
  }

  const supabase = getServiceSupabase();
  let q = supabase
    .from("deliveries")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100)
    .in("vendor_public_id", gate.actor.vendorIds);
  if (vendorId) {
    if (!gate.actor.vendorIds.includes(vendorId)) {
      return NextResponse.json(
        { error: { message: "Vendor out of scope" } },
        { status: 403 },
      );
    }
    q = q.eq("vendor_public_id", vendorId);
  }
  const { data, error } = await q;
  if (error) {
    return NextResponse.json(
      { error: { message: error.message } },
      { status: 500 },
    );
  }

  const deliveries = data || [];
  const driverIds = [
    ...new Set(
      deliveries
        .map((d) => d.driver_clerk_user_id)
        .filter((id): id is string => !!id),
    ),
  ];

  let driver_locations: unknown[] = [];
  if (driverIds.length) {
    const { data: locs } = await supabase
      .from("driver_locations")
      .select("*")
      .in("clerk_user_id", driverIds);
    driver_locations = locs || [];
  }

  return NextResponse.json({ data: deliveries, driver_locations });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const vendorId = String(body?.vendorId || "");
  const action = String(body?.action || "create");

  if (action === "assign") {
    const gate = await requireVendorPermission("delivery:assign", { vendorId });
    if (!gate.ok) return gate.response;
    if (!gate.actor.vendorIds.includes(vendorId)) {
      return NextResponse.json(
        { error: { message: "Vendor out of scope" } },
        { status: 403 },
      );
    }
    const id = String(body?.id || "");
    const driverClerkUserId = String(
      body?.driverClerkUserId || body?.driverId || "",
    );
    if (!id || !driverClerkUserId) {
      return NextResponse.json(
        { error: { message: "id and driverClerkUserId required" } },
        { status: 400 },
      );
    }
    const { data, error } = await getServiceSupabase()
      .from("deliveries")
      .update({
        driver_clerk_user_id: driverClerkUserId,
        status: "assigned",
        assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("vendor_public_id", vendorId)
      .select("*")
      .maybeSingle();
    if (error) {
      return NextResponse.json(
        { error: { message: error.message } },
        { status: 500 },
      );
    }

    await emitVendorActivity({
      vendorPublicId: vendorId,
      kind: "driver",
      title: "Driver assigned",
      body: `Delivery ${data?.public_id || id} → ${driverClerkUserId}`,
      refType: "delivery",
      refId: data?.public_id || id,
      meta: { driverClerkUserId },
    });
    await notifyVendorStaff({
      vendorPublicId: vendorId,
      title: "Driver assigned",
      body: `Delivery ${data?.public_id || id}`,
      href: "/app/couriers",
    });

    return NextResponse.json({ data });
  }

  const gate = await requireVendorPermission("delivery:assign", { vendorId });
  if (!gate.ok) return gate.response;
  if (!gate.actor.vendorIds.includes(vendorId)) {
    return NextResponse.json(
      { error: { message: "Vendor out of scope" } },
      { status: 403 },
    );
  }

  const lat = body?.lat != null && body.lat !== "" ? Number(body.lat) : null;
  const lng = body?.lng != null && body.lng !== "" ? Number(body.lng) : null;

  const otpCode = String(Math.floor(100000 + Math.random() * 900000));

  const row = {
    public_id: publicId("dlv"),
    vendor_public_id: vendorId,
    order_public_id: body?.orderId ? String(body.orderId) : null,
    customer_name: body?.customerName ? String(body.customerName) : null,
    address_text: body?.addressText ? String(body.addressText) : null,
    lat: Number.isFinite(lat as number) ? lat : null,
    lng: Number.isFinite(lng as number) ? lng : null,
    otp_code: otpCode,
    status: "pending",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await getServiceSupabase()
    .from("deliveries")
    .insert(row)
    .select("*")
    .maybeSingle();
  if (error) {
    return NextResponse.json(
      { error: { message: error.message } },
      { status: 500 },
    );
  }

  await emitVendorActivity({
    vendorPublicId: vendorId,
    kind: "driver",
    title: "Delivery created",
    body: row.customer_name
      ? `${row.customer_name} · OTP ${otpCode}`
      : `${row.public_id} · OTP ${otpCode}`,
    refType: "delivery",
    refId: row.public_id,
    meta: { otpCode },
  });
  await notifyVendorStaff({
    vendorPublicId: vendorId,
    title: "Delivery created",
    body: row.customer_name || row.public_id,
    href: "/app/couriers",
  });

  return NextResponse.json({ data }, { status: 201 });
}
