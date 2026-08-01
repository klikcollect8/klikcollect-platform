import Link from "next/link";
import {
  Activity,
  Flag,
  HeartPulse,
  Package,
  ShoppingBag,
  Store,
  Ticket,
  Users,
} from "lucide-react";
import { listApplications } from "@/lib/m1-store";
import { listCatalogue } from "@/lib/catalogue-store";
import { listSupportTickets } from "@/lib/support-store";
import { ensureOrderSeed, listOsOrders } from "@/lib/orders-store";
import { ui } from "@/components/system/tokens";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  await ensureOrderSeed();

  const [apps, catalogue, tickets, orders] = await Promise.all([
    listApplications(),
    listCatalogue(),
    listSupportTickets({ type: "ticket" }),
    listOsOrders(),
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

  const queues = [
    {
      title: "Vendor curation",
      value: pendingVendors,
      hint: "Waiting for admit/reject",
      href: "/admin/vendors",
      icon: Store,
    },
    {
      title: "Open orders",
      value: openOrders,
      hint: "Fulfilment queue",
      href: "/admin/orders",
      icon: ShoppingBag,
    },
    {
      title: "Support tickets",
      value: openTickets,
      hint: "Open issues",
      href: "/admin/support",
      icon: Ticket,
    },
    {
      title: "Low stock",
      value: lowStock,
      hint: "≤ 5 units",
      href: "/admin/products",
      icon: Package,
    },
  ];

  const modules = [
    { href: "/admin/vendors", label: "Vendors", icon: Store },
    { href: "/admin/products", label: "Products", icon: Package },
    { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
    { href: "/admin/customers", label: "Customers", icon: Users },
    { href: "/admin/support", label: "Support", icon: Ticket },
    { href: "/admin/system", label: "Health", icon: HeartPulse },
    { href: "/admin/system/flags", label: "Flags", icon: Flag },
    { href: "/admin/system/logs", label: "Logs", icon: Activity },
  ];

  return (
    <div className="w-full space-y-12">
      <div>
        <p className={ui.pageEyebrow}>Admin</p>
        <h1
          className={`mt-2 ${ui.pageTitle}`}
          style={{ fontFamily: "var(--font-display), sans-serif" }}
        >
          Platform overview
        </h1>
        <p className={`mt-2 max-w-lg ${ui.pageDesc}`}>
          Work queues for marketplace ops. {published} published listings.
        </p>
      </div>

      <section>
        <h2 className="mb-5 text-[11px] font-medium uppercase tracking-[0.16em] text-black/35">
          Needs attention
        </h2>
        <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-4">
          {queues.map((q) => {
            const Icon = q.icon;
            return (
              <Link
                key={q.href}
                href={q.href}
                className="block transition-opacity hover:opacity-70"
              >
                <Icon className="h-4 w-4 text-black/25" strokeWidth={1.5} />
                <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.14em] text-black/35">
                  {q.title}
                </p>
                <p
                  className="mt-2 text-[26px] font-medium tabular-nums tracking-tight text-black"
                  style={{ fontFamily: "var(--font-display), sans-serif" }}
                >
                  {q.value}
                </p>
                <p className="mt-1.5 text-[13px] text-black/40">{q.hint}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-5 text-[11px] font-medium uppercase tracking-[0.16em] text-black/35">
          Modules
        </h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <Link
                key={m.href}
                href={m.href}
                className="flex items-center gap-2.5 py-1.5 text-[14px] text-black/50 transition-colors hover:text-black"
              >
                <Icon className="h-3.5 w-3.5 text-black/25" strokeWidth={1.5} />
                {m.label}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
