import Link from "next/link";
import { ModuleShell } from "@/components/os/ModuleShell";
import { OsStat } from "@/components/os/OsPanel";
import { ProductsTable } from "./ProductsTable";
import { messages } from "@/messages/en-KE";
import { listCatalogue } from "@/lib/catalogue-store";
import { ensureNairobiSeed, VENDORS } from "@/lib/seed-nairobi";

export default async function OsProductsPage() {
  await ensureNairobiSeed();
  const products = await listCatalogue();
  const vendorMap = Object.fromEntries(VENDORS.map((v) => [v.id, v.name]));
  const published = products.filter((p) => p.status === "published").length;
  const low = products.filter((p) => p.stock <= 5).length;

  return (
    <ModuleShell
      title={messages.os.products}
      description="Founding-cohort catalogue — Green Valley, Dairy Crest, Pantry House, Sip House, Crunch Corner, and more."
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
        <OsStat label="Low stock" value={low} />
        <OsStat label="Vendors" value={VENDORS.length} />
      </div>

      <ProductsTable products={products} vendors={vendorMap} />
    </ModuleShell>
  );
}
