import Link from "next/link";
import { ModuleShell } from "@/components/os/ModuleShell";
import { OsStat } from "@/components/os/OsPanel";
import { ProductsTable } from "./ProductsTable";
import { messages } from "@/messages/en-KE";
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
  const draft = products.filter((p) => p.status === "draft").length;
  const rows = products.map((p) => ({
    ...p,
    price: p.price ?? 0,
    stock: p.stock ?? 0,
  }));

  return (
    <ModuleShell
      title={messages.os.products}
      description="Your store catalogue - listings, pricing, and stock for this vendor only."
      live
      actions={
        <>
          <Link
            href="/app/products/import"
            className="rounded-[var(--kc-radius-sm)] border border-[var(--kc-line)] bg-white px-3 py-2 text-[13px] font-medium hover:bg-[var(--kc-canvas)]"
          >
            Import
          </Link>
          <Link
            href="/app/products/new"
            className="rounded-[var(--kc-radius-sm)] bg-[var(--kc-ink)] px-3 py-2 text-[13px] font-medium text-white hover:bg-black"
          >
            Add product
          </Link>
        </>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OsStat label="Products" value={products.length} />
        <OsStat label="Active" value={published} />
        <OsStat label="Draft" value={draft} />
        <OsStat label="Low stock" value={low} />
      </div>

      <ProductsTable products={rows} vendors={vendorMap} />
    </ModuleShell>
  );
}
