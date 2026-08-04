import Link from "next/link";
import { ModuleShell } from "@/components/os/ModuleShell";
import { OsStat } from "@/components/os/OsPanel";
import { OrdersBoard } from "./OrdersBoard";
import { messages } from "@/messages/en-KE";
import { ensureOrderSeed, listOsOrders } from "@/lib/orders-store";
import { requireVendorActor } from "@/lib/auth/require-vendor";

export default async function OsOrdersPage() {
  await ensureOrderSeed();
  const gate = await requireVendorActor();
  const vendorId = gate.ok ? gate.actor.vendorIds[0] || "" : "";
  const orders = vendorId ? await listOsOrders(vendorId) : [];

  const open = orders.filter((o) =>
    ["pending", "confirmed", "ready"].includes(o.status),
  ).length;
  const ready = orders.filter((o) => o.status === "ready").length;
  const collected = orders.filter((o) => o.status === "collected").length;

  return (
    <ModuleShell
      title={messages.os.orders}
      description="Your order queue - confirm, pack, collect, and dispatch delivery."
      live
      actions={
        <>
          <Link
            href="/app/orders/packing"
            className="rounded-[var(--kc-radius-sm)] border border-[var(--kc-line)] bg-white px-3 py-2 text-[13px] font-medium hover:bg-[var(--kc-canvas)]"
          >
            Packing
          </Link>
          <Link
            href="/shop"
            className="rounded-[var(--kc-radius-sm)] border border-[var(--kc-line)] bg-white px-3 py-2 text-[13px] font-medium hover:bg-[var(--kc-canvas)]"
          >
            Preview storefront
          </Link>
        </>
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
