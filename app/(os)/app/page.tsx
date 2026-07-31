import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { OsPanel, OsPanelHeader } from "@/components/os/OsPanel";
import { listCatalogue } from "@/lib/catalogue-store";
import { countUsageEvents, listApplications, recentUsageEvents } from "@/lib/m1-store";
import { ensureNairobiSeed, VENDORS } from "@/lib/seed-nairobi";
import { ensureOrderSeed, listOsOrders } from "@/lib/orders-store";
import { formatKesMajor } from "@/lib/money";
import { ui } from "@/components/system/tokens";

function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat("en-KE", {
      hour: "numeric",
      hour12: false,
      timeZone: "Africa/Nairobi",
    }).format(new Date()),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function OsOverviewPage() {
  await ensureNairobiSeed();
  await ensureOrderSeed();

  const [catalogue, events, applications, recent, orders] = await Promise.all([
    listCatalogue(),
    countUsageEvents(),
    listApplications(),
    recentUsageEvents(5),
    listOsOrders(),
  ]);

  const pendingCuration = applications.filter((a) => a.status === "pending").length;
  const onHand = catalogue.reduce((sum, p) => sum + (p.stock || 0), 0);
  const lowStock = catalogue.filter((p) => p.stock > 0 && p.stock <= 5);
  const toFulfill = orders.filter((o) =>
    ["pending", "confirmed", "ready"].includes(o.status),
  );
  const ready = orders.filter((o) => o.status === "ready");

  const today = new Intl.DateTimeFormat("en-KE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Africa/Nairobi",
  }).format(new Date());

  const todos = [
    toFulfill.length
      ? { label: `${toFulfill.length} orders to fulfil`, href: "/app/orders" }
      : null,
    ready.length
      ? { label: `${ready.length} ready for collect`, href: "/app/orders" }
      : null,
    pendingCuration
      ? { label: `${pendingCuration} applications to review`, href: "/app/curation" }
      : null,
    lowStock.length
      ? { label: `${lowStock.length} low stock SKUs`, href: "/app/inventory" }
      : null,
  ].filter(Boolean) as Array<{ label: string; href: string }>;

  const setup = [
    { done: catalogue.length > 0, label: "Add products from founding vendors", href: "/app/products" },
    { done: applications.some((a) => a.status === "admitted"), label: "Admit vendors through curation", href: "/app/curation" },
    { done: orders.length > 0, label: "Process a click & collect order", href: "/app/orders" },
    { done: events > 0, label: "Confirm usage events are capturing", href: "/app/analytics" },
  ];
  const setupDone = setup.filter((s) => s.done).length;

  const metrics = [
    { label: "Listings", value: catalogue.length },
    { label: "On hand", value: onHand },
    { label: "Open orders", value: toFulfill.length },
    { label: "Ready", value: ready.length },
    { label: "Curation", value: pendingCuration },
    { label: "Events", value: events },
  ];

  return (
    <div className="w-full space-y-12">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={ui.pageEyebrow}>{today}</p>
          <h1
            className={`mt-2 ${ui.pageTitle}`}
            style={{ fontFamily: "var(--font-display), sans-serif" }}
          >
            {greeting()}
          </h1>
          <p className={`mt-2 ${ui.pageDesc}`}>Founding cohort · Nairobi</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/products/new" className={ui.btnPrimary}>
            Add product
          </Link>
          <Link href="/app/orders" className={ui.btnSecondary}>
            View orders
          </Link>
        </div>
      </div>

      {todos.length ? (
        <section>
          <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-black/35">
            Next up
          </h2>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {todos.map((t) => (
              <Link
                key={t.label}
                href={t.href}
                className="text-[15px] text-black/55 transition-colors hover:text-black"
              >
                {t.label}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-5 text-[11px] font-medium uppercase tracking-[0.16em] text-black/35">
          Today
        </h2>
        <div className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-3 xl:grid-cols-6">
          {metrics.map((m) => (
            <div key={m.label}>
              <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-black/35">
                {m.label}
              </div>
              <div
                className="mt-2 text-[24px] font-medium tabular-nums tracking-tight text-black"
                style={{ fontFamily: "var(--font-display), sans-serif" }}
              >
                {m.value}
              </div>
            </div>
          ))}
        </div>
      </section>

      <OsPanel padded={false}>
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-black/35">
              Setup
            </h2>
            <p className="mt-1 text-[13px] text-black/40">
              {setupDone} of {setup.length} complete
            </p>
          </div>
        </div>
        <div className="space-y-3">
          {setup.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className="flex items-center gap-3 text-[14px] transition-opacity hover:opacity-60"
            >
              <span
                className={
                  s.done
                    ? "flex h-4 w-4 shrink-0 items-center justify-center bg-black text-[9px] text-white"
                    : "flex h-4 w-4 shrink-0 border border-black/20"
                }
              >
                {s.done ? "✓" : null}
              </span>
              <span className={s.done ? "text-black/30 line-through" : "text-black"}>
                {s.label}
              </span>
            </Link>
          ))}
        </div>
      </OsPanel>

      <div className="grid gap-12 lg:grid-cols-2">
        <OsPanel padded={false}>
          <OsPanelHeader
            title="Recent listings"
            action={
              <Link
                href="/app/products"
                className="inline-flex items-center gap-1 text-[13px] text-black/40 transition-colors hover:text-black"
              >
                View all <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <div className="space-y-4">
            {catalogue.slice(0, 5).map((p) => (
              <Link
                key={p.id}
                href={`/products/${p.id}`}
                className="flex items-center gap-4 transition-opacity hover:opacity-60"
              >
                <div className="h-12 w-10 shrink-0 overflow-hidden bg-black/[0.03]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.image} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium text-black">{p.name}</div>
                  <div className="mt-0.5 truncate text-[12px] text-black/35">
                    {VENDORS.find((v) => v.id === p.vendorId)?.name || "Vendor"} · {p.stock}
                  </div>
                </div>
                <div className="shrink-0 text-[14px] tabular-nums text-black">
                  {formatKesMajor(p.price)}
                </div>
              </Link>
            ))}
          </div>
        </OsPanel>

        <div className="space-y-10">
          <OsPanel padded={false}>
            <OsPanelHeader title="Founding vendors" />
            <div className="space-y-4">
              {VENDORS.slice(0, 4).map((v) => (
                <div key={v.id} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-black/[0.04] text-[11px] font-medium text-black/40">
                    {v.name
                      .split(" ")
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-medium text-black">{v.name}</div>
                    <div className="truncate text-[12px] text-black/35">{v.neighbourhood}</div>
                  </div>
                </div>
              ))}
            </div>
            <Link
              href="/app/marketplace"
              className="mt-5 inline-block text-[13px] text-black/40 transition-colors hover:text-black"
            >
              View marketplace
            </Link>
          </OsPanel>

          <OsPanel padded={false}>
            <OsPanelHeader
              title="Activity"
              action={
                <Link
                  href="/app/analytics"
                  className="text-[13px] text-black/40 transition-colors hover:text-black"
                >
                  Analytics
                </Link>
              }
            />
            {recent.length ? (
              <div className="space-y-3">
                {recent.map((e) => (
                  <div key={e.id}>
                    <div className="truncate text-[14px] font-medium text-black">{e.name}</div>
                    <div className="text-[12px] text-black/35">
                      {new Date(e.createdAt).toLocaleString("en-KE")}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[14px] text-black/35">No events yet</p>
            )}
          </OsPanel>
        </div>
      </div>
    </div>
  );
}
