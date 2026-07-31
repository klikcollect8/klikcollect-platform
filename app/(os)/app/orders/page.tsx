import Link from "next/link";
import { ModuleShell } from "@/components/os/ModuleShell";
import { OsStat } from "@/components/os/OsPanel";
import { OrdersBoard } from "./OrdersBoard";
import { messages } from "@/messages/en-KE";
import { ensureNairobiSeed } from "@/lib/seed-nairobi";
import { ensureOrderSeed, listOsOrders } from "@/lib/orders-store";

export default async function OsOrdersPage() {
  await ensureNairobiSeed();
  await ensureOrderSeed();
  const orders = await listOsOrders();

  const open = orders.filter((o) =>
    ["pending", "confirmed", "ready"].includes(o.status),
  ).length;
  const ready = orders.filter((o) => o.status === "ready").length;
  const collected = orders.filter((o) => o.status === "collected").length;

  return (
    <ModuleShell
      title={messages.os.orders}
      description="Nairobi click & collect — Westlands, Kilimani, Karen. Lifecycle is money-free until M3."
      live
      actions={
        <Link
          href="/shop"
          className="rounded-[var(--kc-radius-sm)] border border-[var(--kc-line)] bg-white px-3 py-2 text-[13px] font-medium hover:bg-[var(--kc-canvas)]"
        >
          Preview storefront
        </Link>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OsStat label="Total" value={orders.length} />
        <OsStat label="Open" value={open} />
        <OsStat label="Ready to collect" value={ready} />
        <OsStat label="Collected" value={collected} />
      </div>

      <OrdersBoard />
    </ModuleShell>
  );
}
