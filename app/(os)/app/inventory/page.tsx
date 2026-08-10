import Link from "next/link";
import { ModuleShell } from "@/components/os/ModuleShell";
import { OsStatStrip } from "@/components/os/OsStatStrip";
import { InventoryBoard } from "./InventoryBoard";
import { messages } from "@/messages/en-KE";
import { listCatalogue } from "@/lib/catalogue-store";
import { requireVendorActor } from "@/lib/auth/require-vendor";
import { osUi } from "@/components/os/os-ui";

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
      description="On-hand stock, movements, and quick adjustments for your store."
      live
      actions={
        <Link href="/app/products" className={osUi.btnSecondary}>
          Catalogue
        </Link>
      }
    >
      <div className="mb-8">
        <OsStatStrip
          items={[
            { label: "SKUs", value: catalogue.length },
            { label: "On hand", value: onHand },
            {
              label: "Low stock",
              value: lowStock,
              hint: "≤ 5 units",
              tone: lowStock > 0 ? "warn" : "default",
            },
            {
              label: "Out",
              value: outOfStock,
              tone: outOfStock > 0 ? "warn" : "default",
            },
          ]}
        />
      </div>

      <InventoryBoard vendors={vendorMap} />
    </ModuleShell>
  );
}
