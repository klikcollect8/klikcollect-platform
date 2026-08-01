import Link from "next/link";
import { ModuleShell } from "@/components/os/ModuleShell";
import { OsStat } from "@/components/os/OsPanel";
import { InventoryBoard } from "./InventoryBoard";
import { messages } from "@/messages/en-KE";
import { listCatalogue } from "@/lib/catalogue-store";
import { getAdmittedVendors } from "@/lib/admitted-vendors";

export default async function OsInventoryPage() {
  const [catalogue, vendors] = await Promise.all([
    listCatalogue(),
    getAdmittedVendors(),
  ]);
  const onHand = catalogue.reduce((sum, p) => sum + (p.stock || 0), 0);
  const lowStock = catalogue.filter((p) => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= 5).length;
  const outOfStock = catalogue.filter((p) => (p.stock ?? 0) <= 0).length;
  const vendorMap = Object.fromEntries(vendors.map((v) => [v.id, v.name]));

  return (
    <ModuleShell
      title={messages.os.inventory}
      description="One stock truth for marketplace listings — adjust on hand here."
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
