import Link from "next/link";
import { ModuleShell } from "@/components/os/ModuleShell";
import { OsStatStrip } from "@/components/os/OsStatStrip";
import { OrdersBoard } from "./OrdersBoard";
import { messages } from "@/messages/en-KE";
import { ensureOrderSeed, listOsOrders } from "@/lib/orders-store";
import { requireVendorActor } from "@/lib/auth/require-vendor";
import { osUi } from "@/components/os/os-ui";

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
      description="Confirm, pack, and hand off collections — tap an order for full detail."
      live
      actions={
        <>
          <Link href="/app/orders/packing" className={osUi.btnSecondary}>
            Packing
          </Link>
          <Link href="/shop" className={osUi.btnGhost}>
            Preview storefront
          </Link>
        </>
      }
    >
      <div className="mb-8">
        <OsStatStrip
          items={[
            { label: "Total", value: orders.length },
            { label: "Open", value: open },
            { label: "Ready", value: ready },
            { label: "Collected", value: collected },
          ]}
        />
      </div>

      <OrdersBoard />
    </ModuleShell>
  );
}
