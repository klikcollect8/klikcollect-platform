import Link from "next/link";
import { ModuleShell } from "@/components/os/ModuleShell";
import { OsStatStrip } from "@/components/os/OsStatStrip";
import { ProductsTable } from "./ProductsTable";
import { listCatalogue } from "@/lib/catalogue-store";
import { requireVendorActor } from "@/lib/auth/require-vendor";
import { osUi } from "@/components/os/os-ui";

export default async function OsProductsPage() {
  const gate = await requireVendorActor();
  const vendorId = gate.ok ? gate.actor.vendorIds[0] || "" : "";
  const products = vendorId ? await listCatalogue(vendorId) : [];
  const vendorMap = vendorId
    ? { [vendorId]: "Your store" }
    : ({} as Record<string, string>);
  const published = products.filter((p) => p.status === "published").length;
  const low = products.filter(
    (p) => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= 5,
  ).length;
  const out = products.filter((p) => (p.stock ?? 0) <= 0).length;
  const rows = products.map((p) => ({
    ...p,
    price: p.price ?? 0,
    stock: p.stock ?? 0,
  }));

  return (
    <ModuleShell
      title="My products"
      description="Assigned catalogue items — open a product to update your price and stock."
      live
      actions={
        <Link href="/app/inventory" className={osUi.btnPrimary}>
          Update stock
        </Link>
      }
    >
      <div className="mb-8">
        <OsStatStrip
          items={[
            { label: "Assigned", value: products.length },
            { label: "Selling", value: published },
            { label: "Low stock", value: low, tone: low > 0 ? "warn" : "default" },
            { label: "Out of stock", value: out, tone: out > 0 ? "warn" : "default" },
          ]}
        />
      </div>

      <ProductsTable products={rows} vendors={vendorMap} offerMode />
    </ModuleShell>
  );
}
