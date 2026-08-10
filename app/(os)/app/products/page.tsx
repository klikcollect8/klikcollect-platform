import Link from "next/link";
import { ModuleShell } from "@/components/os/ModuleShell";
import { OsStat } from "@/components/os/OsPanel";
import { ProductsTable } from "./ProductsTable";
import { listCatalogue } from "@/lib/catalogue-store";
import { requireVendorActor } from "@/lib/auth/require-vendor";

export default async function OsProductsPage() {
  const gate = await requireVendorActor();
  const vendorId = gate.ok ? gate.actor.vendorIds[0] || "" : "";
  const products = vendorId ? await listCatalogue(vendorId) : [];
  const vendorMap = vendorId
    ? { [vendorId]: "Your store" }
    : ({} as Record<string, string>);
  const published = products.filter((p) => p.status === "published").length;
  const low = products.filter((p) => (p.stock ?? 0) <= 5).length;
  const out = products.filter((p) => (p.stock ?? 0) <= 0).length;
  const rows = products.map((p) => ({
    ...p,
    price: p.price ?? 0,
    stock: p.stock ?? 0,
  }));

  return (
    <ModuleShell
      title="My products"
      description="Platform catalogue items assigned to your store. Update your price and stock — product details are managed by KlikCollect."
      live
      actions={
        <Link
          href="/app/inventory"
          className="rounded-[var(--kc-radius-sm)] bg-[var(--kc-ink)] px-3 py-2 text-[13px] font-medium text-white hover:bg-black"
        >
          Update stock
        </Link>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OsStat label="Assigned" value={products.length} />
        <OsStat label="Selling" value={published} />
        <OsStat label="Low stock" value={low} />
        <OsStat label="Out of stock" value={out} />
      </div>

      <ProductsTable products={rows} vendors={vendorMap} offerMode />
    </ModuleShell>
  );
}
