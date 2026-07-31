import Link from "next/link";
import { ModuleShell } from "@/components/os/ModuleShell";
import { OsEmpty, OsPanel, OsStat } from "@/components/os/OsPanel";
import { messages } from "@/messages/en-KE";
import { listApplications } from "@/lib/m1-store";
import { ensureNairobiSeed } from "@/lib/seed-nairobi";
import { ensureOrderSeed, listOsOrders } from "@/lib/orders-store";

export default async function OsCustomersPage() {
  await ensureNairobiSeed();
  await ensureOrderSeed();

  const [applications, orders] = await Promise.all([
    listApplications(),
    listOsOrders(),
  ]);

  const admitted = applications.filter((a) => a.status === "admitted");
  const pending = applications.filter((a) => a.status === "pending");

  const buyers = new Map<
    string,
    { name: string; email: string; phone: string; orders: number; hubs: Set<string> }
  >();
  for (const o of orders) {
    const key = (o.customerEmail || o.id).toLowerCase();
    const prev = buyers.get(key);
    const hubs = prev?.hubs || new Set<string>();
    hubs.add(o.collectHub);
    buyers.set(key, {
      name: o.customerName || "Customer",
      email: o.customerEmail || key,
      phone: o.customerPhone || prev?.phone || "",
      orders: (prev?.orders || 0) + 1,
      hubs,
    });
  }
  const buyerList = [...buyers.values()].sort((a, b) => b.orders - a.orders);

  return (
    <ModuleShell
      title={messages.os.customers}
      description="Nairobi click & collect buyers plus admitted vendors from curation."
      live
      actions={
        <Link
          href="/app/orders"
          className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Open orders
        </Link>
      }
    >
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OsStat label="Buyers" value={buyerList.length} />
        <OsStat label="Admitted vendors" value={admitted.length} />
        <OsStat label="Pending vendors" value={pending.length} />
        <OsStat label="Orders" value={orders.length} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <OsPanel padded={false}>
          <div className="border-b border-neutral-100 px-4 py-3 text-sm font-semibold sm:px-5">
            Buyers
          </div>
          {buyerList.length ? (
            <div className="divide-y divide-neutral-100">
              {buyerList.slice(0, 20).map((b) => (
                <div
                  key={b.email}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5"
                >
                  <div>
                    <div className="font-medium text-neutral-900">{b.name}</div>
                    <div className="text-xs text-neutral-500">{b.email}</div>
                    <div className="mt-0.5 text-[11px] text-neutral-400">
                      {[...b.hubs].join(" · ")}
                      {b.phone ? ` · ${b.phone}` : ""}
                    </div>
                  </div>
                  <span className="text-xs text-neutral-400">{b.orders} orders</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-8">
              <OsEmpty
                title="No buyer activity yet"
                body="Click & collect orders will appear here once seeded or placed."
              />
            </div>
          )}
        </OsPanel>

        <OsPanel padded={false}>
          <div className="border-b border-neutral-100 px-4 py-3 text-sm font-semibold sm:px-5">
            Admitted vendors
          </div>
          {admitted.length ? (
            <div className="divide-y divide-neutral-100">
              {admitted.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5"
                >
                  <div>
                    <div className="font-medium text-neutral-900">{v.businessName}</div>
                    <div className="text-xs text-neutral-500">
                      {v.neighbourhood} · {v.contactEmail}
                    </div>
                  </div>
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                    Admitted
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-8">
              <OsEmpty
                title="No admitted vendors"
                body="Review the curation queue to admit founding cohort shops."
              />
            </div>
          )}
          {pending.length ? (
            <div className="border-t border-neutral-100 px-4 py-3 text-xs text-neutral-500 sm:px-5">
              {pending.length} application{pending.length === 1 ? "" : "s"} waiting in{" "}
              <Link href="/app/curation" className="font-medium text-neutral-900 underline">
                curation
              </Link>
              .
            </div>
          ) : null}
        </OsPanel>
      </div>
    </ModuleShell>
  );
}
