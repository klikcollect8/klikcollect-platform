import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { listApplications } from "@/lib/m1-store";
import { listCatalogue } from "@/lib/catalogue-store";
import { listSupportTickets } from "@/lib/support-store";
import { ensureOrderSeed, listOsOrders } from "@/lib/orders-store";
import { getFeatureFlags } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

function buildSeries(seed: number) {
  const days = [
    "Jan 1",
    "Jan 5",
    "Jan 9",
    "Jan 13",
    "Jan 17",
    "Jan 21",
    "Jan 25",
    "Jan 29",
  ];
  return days.map((day, i) => {
    const value = Math.max(
      12,
      Math.round(seed * (0.55 + (i % 5) * 0.12) + i * 4),
    );
    const prev = Math.max(10, Math.round(value * 0.76));
    return { day, value, prev };
  });
}

function buildActivity(n: number) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const base = Math.max(50, n * 22);
  return days.map((day, i) => ({
    day,
    value: Math.round(base * (0.45 + ((i * 17 + n) % 7) * 0.11)),
  }));
}

export default async function AdminOverviewPage() {
  await ensureOrderSeed();

  const [apps, catalogue, tickets, orders, flags] = await Promise.all([
    listApplications(),
    listCatalogue(),
    listSupportTickets({ type: "ticket" }),
    listOsOrders(),
    getFeatureFlags(),
  ]);

  const pendingVendors = apps.filter((a) => a.status === "pending").length;
  const openTickets = tickets.filter((t) => t.status !== "resolved").length;
  const openOrders = orders.filter((o) =>
    ["pending", "confirmed", "ready"].includes(o.status),
  ).length;
  const lowStock = catalogue.filter((p) => (p.stock ?? 0) <= 5).length;
  const published = catalogue.filter(
    (p) => !p.status || p.status === "published",
  ).length;

  const revenueMinor = orders.reduce(
    (sum, o) => sum + (typeof o.totalMinor === "number" ? o.totalMinor : 0),
    0,
  );
  const profitKes =
    revenueMinor > 0
      ? Math.round(revenueMinor / 100)
      : Math.max(180000, catalogue.length * 5200 + orders.length * 9200);

  const clearScore = Math.max(
    35,
    100 -
      pendingVendors * 8 -
      openTickets * 4 -
      Math.min(openOrders, 20) * 2 -
      Math.min(lowStock, 15),
  );

  return (
    <AdminDashboard
      published={published}
      initialFlags={flags}
      metrics={{
        vendorsPending: pendingVendors,
        ordersOpen: openOrders,
        ticketsOpen: openTickets,
        lowStock,
        products: catalogue.length,
        ordersTotal: orders.length,
      }}
      profitKes={profitKes}
      profitDelta="18.2%"
      profitSeries={buildSeries(Math.round(profitKes / 1000))}
      segments={[
        {
          label: "Vendors admitted",
          value: apps.filter((a) => a.status === "admitted").length || 12,
          color: "#2563EB",
        },
        {
          label: "Active listings",
          value: published || catalogue.length,
          color: "#22C55E",
        },
        {
          label: "Open support",
          value: openTickets || 3,
          color: "#F59E0B",
        },
      ]}
      activity={buildActivity(orders.length + apps.length)}
      repeatRate={clearScore}
      queues={[
        {
          title: "Vendor curation",
          value: pendingVendors,
          hint: "Waiting for admit/reject",
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
          hint: "Open issues",
          href: "/admin/support",
        },
        {
          title: "Low stock",
          value: lowStock,
          hint: "≤ 5 units",
          href: "/admin/products",
        },
      ]}
    />
  );
}
