import Link from "next/link";
import { ModuleShell } from "@/components/os/ModuleShell";
import { OsEmpty, OsPanel, OsStat } from "@/components/os/OsPanel";
import { messages } from "@/messages/en-KE";
import { countUsageEvents, recentUsageEvents } from "@/lib/m1-store";
import { listCatalogue } from "@/lib/catalogue-store";

async function loadOrderStats() {
  try {
    const { ensureOrderSeed, listOsOrders } = await import("@/lib/orders-store");
    await ensureOrderSeed();
    const orders = await listOsOrders();
    const open = orders.filter((o) =>
      ["pending", "confirmed", "ready"].includes(o.status),
    );
    const ready = orders.filter((o) => o.status === "ready");
    return { total: orders.length, open: open.length, ready: ready.length };
  } catch {
    return { total: 0, open: 0, ready: 0 };
  }
}

export default async function OsAnalyticsPage() {
  const [count, recent, catalogue, orderStats] = await Promise.all([
    countUsageEvents(),
    recentUsageEvents(40),
    listCatalogue(),
    loadOrderStats(),
  ]);

  const lowStock = catalogue.filter((p) => (p.stock ?? 0) <= 5).length;
  const published = catalogue.filter(
    (p) => !p.status || p.status === "published",
  ).length;

  const byName = new Map<string, number>();
  for (const e of recent) {
    byName.set(e.name, (byName.get(e.name) || 0) + 1);
  }
  const topEvents = [...byName.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  const actions = [
    {
      label: "Fulfil open orders",
      value: orderStats.open,
      href: "/app/orders",
      hint: orderStats.ready
        ? `${orderStats.ready} ready to collect`
        : "Advance pending → ready",
    },
    {
      label: "Restock low inventory",
      value: lowStock,
      href: "/app/inventory",
      hint: "Items at 5 units or fewer",
    },
    {
      label: "Keep catalogue accurate",
      value: published,
      href: "/app/products",
      hint: "Published listings",
    },
  ];

  return (
    <ModuleShell
      title={messages.os.analytics}
      description="Actionable signals from day-one events — every metric links to work."
      live
      actions={
        <Link
          href="/admin/analytics"
          className="rounded-[var(--kc-radius-sm)] border border-[var(--kc-line)] bg-white px-3 py-2 text-[13px] font-medium text-[var(--kc-ink)] hover:bg-[var(--kc-canvas)]"
        >
          Admin analytics
        </Link>
      }
    >
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OsStat label="Events captured" value={count} />
        <OsStat label="Open orders" value={orderStats.open} hint="Needs fulfilment" />
        <OsStat label="Low stock SKUs" value={lowStock} hint="≤ 5 units" />
        <OsStat label="Active listings" value={published} />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {actions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-white px-4 py-4 transition-colors hover:bg-[var(--kc-canvas)]"
          >
            <p className="text-[12px] font-medium text-[var(--kc-faint)]">{a.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--kc-ink)]">
              {a.value}
            </p>
            <p className="mt-1 text-[12px] text-[var(--kc-mute)]">{a.hint}</p>
            <p className="mt-3 text-[12px] font-medium text-[var(--kc-ink)] underline underline-offset-4">
              Open queue
            </p>
          </Link>
        ))}
      </div>

      {topEvents.length ? (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {topEvents.map(([name, n]) => (
            <div
              key={name}
              className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-white px-4 py-3"
            >
              <div className="truncate text-[12px] text-[var(--kc-faint)]">{name}</div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-[var(--kc-ink)]">
                {n}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <OsPanel padded={false}>
        <div className="border-b border-[var(--kc-line-soft)] px-4 py-3 text-[13px] font-semibold text-[var(--kc-ink)] sm:px-5">
          Recent events
        </div>
        {recent.length ? (
          <div className="divide-y divide-[var(--kc-line-soft)]">
            {recent.map((e) => (
              <div
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[13px] sm:px-5"
              >
                <span className="font-medium text-[var(--kc-ink)]">{e.name}</span>
                <span className="text-[12px] text-[var(--kc-faint)]">
                  {e.actorType} · {new Date(e.createdAt).toLocaleString("en-KE")}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <OsEmpty
            title="No events yet"
            body="Browse the storefront and operate modules to start capture."
          />
        )}
      </OsPanel>
    </ModuleShell>
  );
}
