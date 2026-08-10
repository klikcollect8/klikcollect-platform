import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { getFeatureFlags } from "@/lib/feature-flags";
import { getMarketplaceMetrics } from "@/lib/admin/marketplace-metrics";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const [metrics, flags] = await Promise.all([
    getMarketplaceMetrics(),
    getFeatureFlags(),
  ]);

  const gmvKes = Math.round(metrics.gmvPeriodMinor / 100);
  const deltaLabel =
    metrics.gmvDeltaPct === 0
      ? "0% vs prior 14 days"
      : metrics.gmvDeltaPct > 0
        ? `${metrics.gmvDeltaPct}% vs prior 14 days`
        : `${metrics.gmvDeltaPct}% vs prior 14 days`;

  const clearScore = Math.max(
    0,
    100 -
      metrics.pendingVendors * 8 -
      metrics.openTickets * 4 -
      Math.min(metrics.openOrders, 20) * 2 -
      Math.min(metrics.openContentReports, 10) * 3 -
      Math.min(metrics.openCorrections, 10) * 2,
  );

  return (
    <AdminDashboard
      published={metrics.published}
      initialFlags={flags}
      metrics={{
        vendorsPending: metrics.pendingVendors,
        ordersOpen: metrics.openOrders,
        ticketsOpen: metrics.openTickets,
        lowStock: metrics.lowStock,
        products: metrics.products,
        ordersTotal: metrics.ordersTotal,
        openCorrections: metrics.openCorrections,
        openContentReports: metrics.openContentReports,
        heldPayouts: metrics.heldPayouts,
        gmvTodayMinor: metrics.gmvTodayMinor,
      }}
      profitKes={gmvKes}
      profitDelta={deltaLabel}
      profitSeries={metrics.gmvSeries}
      segments={[
        {
          label: "Vendors admitted",
          value: metrics.admittedVendors,
          color: "#2563EB",
        },
        {
          label: "Active listings",
          value: metrics.published || metrics.products,
          color: "#22C55E",
        },
        {
          label: "Open support",
          value: metrics.openTickets,
          color: "#F59E0B",
        },
        {
          label: "Content reports",
          value: metrics.openContentReports,
          color: "#8e1b0d",
        },
      ]}
      activity={metrics.activitySeries}
      repeatRate={clearScore}
      queues={metrics.alerts}
      volumeLabel="Marketplace GMV (14d)"
    />
  );
}
