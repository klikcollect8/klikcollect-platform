import { NextRequest, NextResponse } from "next/server";
import { requireVendorPermission } from "@/lib/auth/require-vendor";
import { inVendorScope, vendorScopeIds } from "@/lib/auth/vendor-scope";
import { customerSegment, listVendorCustomers } from "@/lib/vendor-customers";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { listOsOrders } from "@/lib/orders-store";
import { emitVendorActivity } from "@/lib/vendor-activity";

export async function GET(request: NextRequest) {
  const vendorId = request.nextUrl.searchParams.get("vendorId") || undefined;
  const gate = await requireVendorPermission("support:customers_view", {
    vendorId,
  });
  if (!gate.ok) return gate.response;

  const scope = vendorId
    ? inVendorScope(gate.actor, vendorId)
      ? [vendorId]
      : []
    : vendorScopeIds(gate.actor);

  const customers = await listVendorCustomers(scope);
  const customerId = request.nextUrl.searchParams.get("id");
  if (customerId) {
    const c = customers.find(
      (x) => x.publicId === customerId || x.id === customerId,
    );
    if (!c) {
      return NextResponse.json(
        { error: { message: "Not found" } },
        { status: 404 },
      );
    }
    const orders = (await listOsOrders()).filter(
      (o) =>
        scope.includes(o.vendorId) &&
        ((c.email && o.customerEmail === c.email) ||
          (c.phone && o.customerPhone === c.phone)),
    );
    return NextResponse.json({
      data: { ...c, segment: customerSegment(c), orders },
    });
  }

  return NextResponse.json({
    data: customers.map((c) => ({
      ...c,
      segment: customerSegment(c),
    })),
  });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const id = String(body?.id || "");
  const vendorId = String(body?.vendorId || "");
  const gate = await requireVendorPermission("support:customers_view", {
    vendorId,
  });
  if (!gate.ok) return gate.response;
  if (!id || !inVendorScope(gate.actor, vendorId)) {
    return NextResponse.json(
      { error: { message: "id and vendorId required" } },
      { status: 400 },
    );
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (body?.notes != null) patch.notes = String(body.notes);
  if (Array.isArray(body?.tags)) patch.tags = body.tags.map(String);
  if (body?.name != null) patch.name = String(body.name);

  const { data, error } = await getServiceSupabase()
    .from("vendor_customers")
    .update(patch)
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
  if (data) {
    await emitVendorActivity({
      vendorPublicId: vendorId,
      kind: "system",
      title: "Customer profile updated",
      body: String(data.name || data.email || data.phone || id),
      refType: "customer",
      refId: String(data.public_id || id),
    });
  }
  return NextResponse.json({ data });
}
