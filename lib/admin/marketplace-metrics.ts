/**
 * Platform marketplace metrics — Nairobi-day buckets from live tables.
 */
import { getServiceSupabase } from "@/lib/supabase/admin";
import { listApplications } from "@/lib/m1-store";
import { listCatalogue } from "@/lib/catalogue-store";
import { listSupportTickets } from "@/lib/support-store";
import { listOsOrders } from "@/lib/orders-store";
import {
  FeatureUnavailableError,
  isMissingRelationError,
  listCatalogueCorrections,
} from "@/lib/offers-mutations";
import { countOpenContentReports } from "@/lib/content-reports";

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

export type MarketplaceMetrics = {
  gmvTodayMinor: number;
  gmvPeriodMinor: number;
  gmvPrevPeriodMinor: number;
  gmvDeltaPct: number;
  orderCountToday: number;
  orderCountPeriod: number;
  openOrders: number;
  ordersTotal: number;
  pendingVendors: number;
  admittedVendors: number;
  openTickets: number;
  openCorrections: number;
  openContentReports: number;
  heldPayouts: number;
  heldPayoutsMinor: number;
  lowStock: number;
  products: number;
  published: number;
  gmvSeries: Array<{ day: string; value: number; prev: number }>;
  activitySeries: Array<{ day: string; value: number }>;
  alerts: Array<{
    title: string;
    value: number;
    hint: string;
    href: string;
  }>;
};

export async function getMarketplaceMetrics(): Promise<MarketplaceMetrics> {
  // Live marketplace truth only — never seed demo orders into GMV.
  const [
    apps,
    catalogue,
    tickets,
    orders,
    corrections,
    openContentReports,
  ] = await Promise.all([
    listApplications(),
    listCatalogue(),
    listSupportTickets({ type: "ticket" }),
    listOsOrders(),
    listCatalogueCorrections({ status: "open", limit: 500 }).catch((e) => {
      if (e instanceof FeatureUnavailableError || isMissingRelationError(e)) {
        return [];
      }
      return [];
    }),
    countOpenContentReports().catch(() => 0),
  ]);

  const pendingVendors = apps.filter((a) => a.status === "pending").length;
  const admittedVendors = apps.filter((a) => a.status === "admitted").length;
  const openTickets = tickets.filter((t) => t.status !== "resolved").length;
  const openOrders = orders.filter((o) =>
    ["pending", "confirmed", "ready", "packing", "processing", "new"].includes(
      o.status,
    ),
  ).length;
  const lowStock = catalogue.filter((p) => (p.stock ?? 0) <= 5).length;
  const published = catalogue.filter(
    (p) => !p.status || p.status === "published",
  ).length;

  const todayStart = startOfTodayNairobi();
  const todayOrders = orders.filter(
    (o) => new Date(o.createdAt).getTime() >= todayStart.getTime(),
  );
  const gmvTodayMinor = todayOrders.reduce(
    (s, o) => s + (o.totalMinor || 0),
    0,
  );

  const DAYS = 14;
  const dayKeys: string[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    dayKeys.push(
      nairobiDayKey(new Date(todayStart.getTime() - i * 86400000)),
    );
  }
  const prevKeys: string[] = [];
  for (let i = DAYS * 2 - 1; i >= DAYS; i--) {
    prevKeys.push(
      nairobiDayKey(new Date(todayStart.getTime() - i * 86400000)),
    );
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

  const gmvPeriodMinor = dayKeys.reduce(
    (s, k) => s + (salesByDay.get(k) || 0),
    0,
  );
  const gmvPrevPeriodMinor = prevKeys.reduce(
    (s, k) => s + (salesByDay.get(k) || 0),
    0,
  );
  const gmvDeltaPct =
    gmvPrevPeriodMinor > 0
      ? Math.round(
          ((gmvPeriodMinor - gmvPrevPeriodMinor) / gmvPrevPeriodMinor) * 100,
        )
      : gmvPeriodMinor > 0
        ? 100
        : 0;

  const gmvSeries = dayKeys.map((key, i) => ({
    day: dayLabel(key),
    value: Math.round((salesByDay.get(key) || 0) / 100),
    prev: Math.round((salesByDay.get(prevKeys[i]) || 0) / 100),
  }));

  const weekKeys = dayKeys.slice(-7);
  const activitySeries = weekKeys.map((key) => ({
    day: dayLabel(key),
    value: ordersByDay.get(key) || 0,
  }));

  const orderCountPeriod = dayKeys.reduce(
    (s, k) => s + (ordersByDay.get(k) || 0),
    0,
  );

  let heldPayouts = 0;
  let heldPayoutsMinor = 0;
  try {
    const sb = getServiceSupabase();
    const { data: payouts, error } = await sb
      .from("payouts")
      .select("amount_minor, status")
      .eq("status", "held")
      .limit(500);
    if (!error && payouts) {
      heldPayouts = payouts.length;
      heldPayoutsMinor = payouts.reduce(
        (s, p) => s + Number(p.amount_minor || 0),
        0,
      );
    }
  } catch {
    /* table optional */
  }

  const openCorrections = Array.isArray(corrections) ? corrections.length : 0;

  const alerts = [
    {
      title: "Pending vendors",
      value: pendingVendors,
      hint: "Awaiting admit/reject",
      href: "/admin/vendors",
    },
    {
      title: "Open orders",
      value: openOrders,
      hint: "Fulfilment queue",
      href: "/admin/orders",
    },
    {
      title: "Support tickets",
      value: openTickets,
      hint: "Unresolved",
      href: "/admin/support",
    },
    {
      title: "Catalogue corrections",
      value: openCorrections,
      hint: "Vendor data requests",
      href: "/admin/catalogue-corrections",
    },
    {
      title: "Content reports",
      value: openContentReports,
      hint: "Moderation queue",
      href: "/admin/content-reports",
    },
    {
      title: "Held payouts",
      value: heldPayouts,
      hint:
        heldPayoutsMinor > 0
          ? `KES ${Math.round(heldPayoutsMinor / 100).toLocaleString("en-KE")}`
          : "Frozen transfers",
      href: "/admin/settlements",
    },
  ].filter((a) => a.value > 0);

  return {
    gmvTodayMinor,
    gmvPeriodMinor,
    gmvPrevPeriodMinor,
    gmvDeltaPct,
    orderCountToday: todayOrders.length,
    orderCountPeriod,
    openOrders,
    ordersTotal: orders.length,
    pendingVendors,
    admittedVendors,
    openTickets,
    openCorrections,
    openContentReports,
    heldPayouts,
    heldPayoutsMinor,
    lowStock,
    products: catalogue.length,
    published,
    gmvSeries,
    activitySeries,
    alerts:
      alerts.length > 0
        ? alerts
        : [
            {
              title: "Queues clear",
              value: 0,
              hint: "No open alerts",
              href: "/admin",
            },
          ],
  };
}
