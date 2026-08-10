import { NextRequest, NextResponse } from "next/server";
import { requireVendorActor } from "@/lib/auth/require-vendor";
import { vendorScopeIds } from "@/lib/auth/vendor-scope";
import { listCatalogue } from "@/lib/catalogue-store";
import { ensureOrderSeed, listOsOrders } from "@/lib/orders-store";
import { availableOf } from "@/lib/inventory";
import { getVendorPayableBalance } from "@/lib/ledger/balances";
import { listVendorActivity } from "@/lib/vendor-activity";
import { listVendorQuestions } from "@/lib/vendor-content";
import { getPublicVendorHours } from "@/lib/vendor-storefront";
import { computeLiveStoreStatus } from "@/lib/store-hours-live";
import { getServiceSupabase } from "@/lib/supabase/admin";

function nairobiDayKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function startOfTodayNairobi(): Date {
  const day = nairobiDayKey(new Date());
  return new Date(`${day}T00:00:00+03:00`);
}

function dayLabel(isoDay: string): string {
  const d = new Date(`${isoDay}T12:00:00+03:00`);
  return new Intl.DateTimeFormat("en-KE", {
    weekday: "short",
    timeZone: "Africa/Nairobi",
  }).format(d);
}

export async function GET(request: NextRequest) {
  const gate = await requireVendorActor();
  if (!gate.ok) return gate.response;

  const vendorIds = vendorScopeIds(gate.actor);
  const vendorId =
    request.nextUrl.searchParams.get("vendorId") || vendorIds[0] || null;
  if (vendorId && !vendorIds.includes(vendorId)) {
    return NextResponse.json(
      { error: { message: "Vendor out of scope" } },
      { status: 403 },
    );
  }
  const scope = vendorId ? [vendorId] : vendorIds;
  const allowed = new Set(scope);

  await ensureOrderSeed();
  const [catalogueAll, ordersAll, activity, availableMinor, questionsPack, hoursPack] =
    await Promise.all([
      listCatalogue(scope[0] || undefined),
      listOsOrders(),
      listVendorActivity(scope, 40),
      scope[0] ? getVendorPayableBalance(scope[0]) : Promise.resolve(0),
      scope.length
        ? listVendorQuestions(scope).catch(() => ({
            questions: [] as Awaited<
              ReturnType<typeof listVendorQuestions>
            >["questions"],
          }))
        : Promise.resolve({ questions: [] }),
      scope[0]
        ? getPublicVendorHours(scope[0]).catch(() => [])
        : Promise.resolve([]),
    ]);

  const catalogue = catalogueAll.filter(
    (p) => p.vendorId && allowed.has(p.vendorId),
  );
  const orders = ordersAll.filter(
    (o) => allowed.has(o.vendorId) || o.vendorIds.some((id) => allowed.has(id)),
  );

  const todayStart = startOfTodayNairobi();
  const todayOrders = orders.filter(
    (o) => new Date(o.createdAt).getTime() >= todayStart.getTime(),
  );
  const todaySalesMinor = todayOrders.reduce(
    (s, o) => s + (o.totalMinor || 0),
    0,
  );
  const completedToday = todayOrders.filter((o) =>
    ["collected", "delivered", "completed"].includes(o.status),
  );
  const todayProfitMinor = Math.round(todaySalesMinor * 0.85);

  const buckets = {
    waiting: orders.filter((o) =>
      ["pending", "new", "confirmed"].includes(o.status),
    ).length,
    packing: orders.filter((o) =>
      ["packing", "processing", "confirmed"].includes(o.status),
    ).length,
    out: orders.filter((o) =>
      ["out_for_delivery", "shipped", "ready"].includes(o.status),
    ).length,
    delivered: orders.filter((o) =>
      ["delivered", "collected", "completed"].includes(o.status),
    ).length,
    returned: orders.filter((o) =>
      ["returned", "cancelled", "rejected"].includes(o.status),
    ).length,
  };

  const lowStock = catalogue.filter((p) => {
    const avail = availableOf(p);
    return avail > 0 && avail <= 5;
  });
  const outOfStock = catalogue.filter((p) => availableOf(p) <= 0);

  const paidOrders = orders.filter((o) => (o.totalMinor || 0) > 0);
  const aovMinor = paidOrders.length
    ? Math.round(
        paidOrders.reduce((s, o) => s + (o.totalMinor || 0), 0) /
          paidOrders.length,
      )
    : 0;

  const emails = paidOrders.map((o) => o.customerEmail).filter(Boolean);
  const unique = new Set(emails);
  let repeats = 0;
  const counts = new Map<string, number>();
  for (const e of emails) {
    counts.set(e!, (counts.get(e!) || 0) + 1);
  }
  for (const n of counts.values()) if (n > 1) repeats++;
  const repeatRate = unique.size ? repeats / unique.size : 0;

  // --- Chart series: last 14 days + previous 14 for dashed compare ---
  const DAYS = 14;
  const dayKeys: string[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(todayStart.getTime() - i * 86400000);
    dayKeys.push(nairobiDayKey(d));
  }
  const prevKeys: string[] = [];
  for (let i = DAYS * 2 - 1; i >= DAYS; i--) {
    const d = new Date(todayStart.getTime() - i * 86400000);
    prevKeys.push(nairobiDayKey(d));
  }

  const salesByDay = new Map<string, number>();
  const ordersByDay = new Map<string, number>();
  for (const key of [...dayKeys, ...prevKeys]) {
    salesByDay.set(key, 0);
    ordersByDay.set(key, 0);
  }
  for (const o of orders) {
    const key = nairobiDayKey(new Date(o.createdAt));
    if (!salesByDay.has(key)) continue;
    salesByDay.set(key, (salesByDay.get(key) || 0) + (o.totalMinor || 0));
    ordersByDay.set(key, (ordersByDay.get(key) || 0) + 1);
  }

  const salesSeries = dayKeys.map((key, i) => ({
    date: key,
    day: dayLabel(key),
    value: Math.round((salesByDay.get(key) || 0) / 100), // KES major
    prev: Math.round((salesByDay.get(prevKeys[i]) || 0) / 100),
  }));

  const ordersSeries = dayKeys.map((key) => ({
    date: key,
    day: dayLabel(key),
    value: ordersByDay.get(key) || 0,
  }));

  const periodSalesMinor = dayKeys.reduce(
    (s, k) => s + (salesByDay.get(k) || 0),
    0,
  );
  const prevPeriodSalesMinor = prevKeys.reduce(
    (s, k) => s + (salesByDay.get(k) || 0),
    0,
  );
  const salesDeltaPct =
    prevPeriodSalesMinor > 0
      ? Math.round(
          ((periodSalesMinor - prevPeriodSalesMinor) / prevPeriodSalesMinor) *
            100,
        )
      : periodSalesMinor > 0
        ? 100
        : 0;

  const sb = getServiceSupabase();
  let storeName = scope[0] ? `Store · ${scope[0].slice(0, 12)}` : "Your store";
  let pendingMinor = 0;
  let heldMinor = 0;
  if (scope[0]) {
    const [{ data: profile }, { data: vendor }] = await Promise.all([
      sb
        .from("vendor_profiles")
        .select("display_name")
        .eq("vendor_public_id", scope[0])
        .maybeSingle(),
      sb.from("vendors").select("name").eq("public_id", scope[0]).maybeSingle(),
    ]);
    storeName = profile?.display_name || vendor?.name || storeName;

    const { data: payouts } = await sb
      .from("payouts")
      .select("amount_minor, status")
      .eq("vendor_public_id", scope[0])
      .in("status", ["pending", "processing", "held"])
      .limit(50);
    for (const p of payouts || []) {
      if (p.status === "held") heldMinor += Number(p.amount_minor || 0);
      else pendingMinor += Number(p.amount_minor || 0);
    }
  }

  const walletSegments = [
    {
      label: "Available",
      value: Math.round(availableMinor / 100),
      color: "#0a0a0a",
    },
    {
      label: "Pending",
      value: Math.round(pendingMinor / 100),
      color: "rgba(0,0,0,0.35)",
    },
    {
      label: "Held",
      value: Math.round(heldMinor / 100),
      color: "rgba(0,0,0,0.15)",
    },
  ].filter((s) => s.value > 0);

  const orderSegments = [
    { label: "Waiting", value: buckets.waiting, color: "#0a0a0a" },
    { label: "Packing", value: buckets.packing, color: "rgba(0,0,0,0.55)" },
    { label: "Out / ready", value: buckets.out, color: "rgba(0,0,0,0.35)" },
    { label: "Delivered", value: buckets.delivered, color: "rgba(0,0,0,0.2)" },
    {
      label: "Cancelled",
      value: buckets.returned,
      color: "rgba(142,27,13,0.55)",
    },
  ].filter((s) => s.value > 0);

  const unansweredQuestions = (questionsPack.questions || []).filter(
    (q) => !q.answers?.length,
  ).length;

  const primaryHours =
    hoursPack.find((h) => h.storePublicId) || hoursPack[0] || null;
  const live = computeLiveStoreStatus(
    primaryHours
      ? { weekly: primaryHours.weekly, holidays: primaryHours.holidays }
      : null,
  );
  const storeStatus = {
    openNow: live.openNow,
    statusLabel: live.statusLabel,
    detailLabel: live.detailLabel,
    todayRange: live.todayRange,
    clock: live.clock,
    storeName: primaryHours?.storeName || storeName,
  };

  return NextResponse.json({
    data: {
      vendorId: scope[0] || null,
      storeName,
      today: {
        salesMinor: todaySalesMinor,
        orders: todayOrders.length,
        profitMinor: todayProfitMinor,
        completed: completedToday.length,
      },
      wallet: {
        availableMinor,
        pendingMinor,
        heldMinor,
      },
      buckets,
      stock: {
        low: lowStock.length,
        out: outOfStock.length,
        onHand: catalogue.reduce((s, p) => s + (p.onHand ?? p.stock ?? 0), 0),
        products: catalogue.length,
      },
      aovMinor,
      repeatRate,
      rating: null,
      attention: {
        unansweredQuestions,
        ordersWaiting: buckets.waiting,
        lowStock: lowStock.length + outOfStock.length,
      },
      storeStatus,
      activity,
      charts: {
        salesSeries,
        ordersSeries,
        periodSalesMinor,
        salesDeltaPct,
        walletSegments,
        orderSegments,
      },
    },
  });
}
