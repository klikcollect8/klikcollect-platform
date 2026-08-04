import Link from "next/link";
import { ModuleShell } from "@/components/os/ModuleShell";
import { OsStat } from "@/components/os/OsPanel";
import { InventoryBoard } from "./InventoryBoard";
import { messages } from "@/messages/en-KE";
import { listCatalogue } from "@/lib/catalogue-store";
import { requireVendorActor } from "@/lib/auth/require-vendor";

export default async function OsInventoryPage() {
  const gate = await requireVendorActor();
  const vendorId = gate.ok ? gate.actor.vendorIds[0] || "" : "";
  const catalogue = vendorId ? await listCatalogue(vendorId) : [];
  const onHand = catalogue.reduce((sum, p) => sum + (p.stock || 0), 0);
  const lowStock = catalogue.filter(
    (p) => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= 5,
  ).length;
  const outOfStock = catalogue.filter((p) => (p.stock ?? 0) <= 0).length;
  const vendorMap = vendorId
    ? { [vendorId]: "Your store" }
    : ({} as Record<string, string>);

  return (
    <ModuleShell
      title={messages.os.inventory}
      description="Stock for your store - on hand, low stock, and adjustments."
      live
      actions={
        <Link
          href="/app/products"
          className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium hover:bg-neutral-50"
        >
          Catalogue
        </Link>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OsStat label="SKUs" value={catalogue.length} />
        <OsStat label="Units on hand" value={onHand} />
        <OsStat label="Low stock" value={lowStock} hint="≤ 5 units" />
        <OsStat label="Out of stock" value={outOfStock} />
      </div>

      <InventoryBoard vendors={vendorMap} />
    </ModuleShell>
  );
}
