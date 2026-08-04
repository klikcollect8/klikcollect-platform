import Link from "next/link";
import { ensureOrderSeed, listOsOrders } from "@/lib/orders-store";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage() {
  await ensureOrderSeed();
  const orders = await listOsOrders();

  const byEmail = new Map<
    string,
    {
      name: string;
      email: string;
      phone: string;
      orders: number;
      lastAt: string;
    }
  >();

  for (const o of orders) {
    const key = (o.customerEmail || o.customerPhone || o.id).toLowerCase();
    const prev = byEmail.get(key);
    if (!prev) {
      byEmail.set(key, {
        name: o.customerName,
        email: o.customerEmail,
        phone: o.customerPhone,
        orders: 1,
        lastAt: o.createdAt,
      });
    } else {
      prev.orders += 1;
      if (o.createdAt > prev.lastAt) prev.lastAt = o.createdAt;
    }
  }

  const customers = [...byEmail.values()].sort((a, b) =>
    b.lastAt.localeCompare(a.lastAt),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--kc-ink)]">
          Customers
        </h1>
        <p className="mt-1 text-[13px] text-[var(--kc-mute)]">
          Shoppers inferred from click &amp; collect orders. Full profiles live
          under Customer account.
        </p>
      </div>

      <div className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-white px-4 py-3 text-[13px] text-[var(--kc-mute)]">
        {customers.length} customers ·{" "}
        <Link
          href="/account"
          className="font-medium text-[var(--kc-ink)] underline underline-offset-4"
        >
          Open customer account shell
        </Link>
      </div>

      <div className="overflow-hidden rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-white">
        <table className="w-full min-w-[640px] text-left text-[13px]">
          <thead className="border-b border-[var(--kc-line-soft)] text-[12px] text-[var(--kc-faint)]">
            <tr>
              <th className="px-4 py-2.5 font-medium">Customer</th>
              <th className="px-4 py-2.5 font-medium">Email</th>
              <th className="px-4 py-2.5 font-medium">Phone</th>
              <th className="px-4 py-2.5 font-medium">Orders</th>
              <th className="px-4 py-2.5 font-medium">Last order</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--kc-line-soft)]">
            {customers.map((c) => (
              <tr
                key={c.email || c.phone}
                className="hover:bg-[var(--kc-canvas)]"
              >
                <td className="px-4 py-3 font-medium text-[var(--kc-ink)]">
                  {c.name}
                </td>
                <td className="px-4 py-3 text-[var(--kc-mute)]">
                  {c.email || " - "}
                </td>
                <td className="px-4 py-3 text-[var(--kc-mute)]">
                  {c.phone || " - "}
                </td>
                <td className="px-4 py-3 tabular-nums text-[var(--kc-ink)]">
                  {c.orders}
                </td>
                <td className="px-4 py-3 text-[var(--kc-faint)]">
                  {new Date(c.lastAt).toLocaleString("en-KE")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!customers.length ? (
          <p className="px-4 py-10 text-center text-[13px] text-[var(--kc-faint)]">
            No customer orders yet.
          </p>
        ) : null}
      </div>
    </div>
  );
}
