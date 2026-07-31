import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ModuleShell } from "@/components/os/ModuleShell";
import { OsPanel, OsStat } from "@/components/os/OsPanel";
import { messages } from "@/messages/en-KE";
import { listApplications } from "@/lib/m1-store";
import { listCatalogue } from "@/lib/catalogue-store";
import { V1_CATEGORIES } from "@/lib/curation-policy";
import { ensureNairobiSeed, VENDORS } from "@/lib/seed-nairobi";
import { formatPrice } from "@/lib/currency";

export default async function OsMarketplacePage() {
  await ensureNairobiSeed();
  const [applications, catalogue] = await Promise.all([
    listApplications(),
    listCatalogue(),
  ]);
  const admitted = applications.filter((a) => a.status === "admitted");
  const pending = applications.filter((a) => a.status === "pending");

  const byVendor = VENDORS.map((v) => ({
    ...v,
    skus: catalogue.filter((p) => p.vendorId === v.id).length,
    sample: catalogue.find((p) => p.vendorId === v.id),
  }));

  const cards = [
    { title: "Storefront", body: "Customer discovery and browse.", href: "/" },
    { title: "Shop", body: `${catalogue.length} listings in catalogue.`, href: "/shop" },
    {
      title: "Curation",
      body: `${pending.length} pending · ${admitted.length} admitted.`,
      href: "/app/curation",
    },
  ];

  return (
    <ModuleShell
      title={messages.os.marketplace}
      description="Grocery storefront — admitted vendors and essentials categories."
      live
      actions={
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Open shop <ArrowRight className="h-4 w-4" />
        </Link>
      }
    >
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OsStat label="Listings" value={catalogue.length} />
        <OsStat label="Pending" value={pending.length} />
        <OsStat label="Admitted" value={admitted.length} />
        <OsStat label="V1 categories" value={V1_CATEGORIES.length} />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="rounded-xl border border-neutral-200 bg-white px-4 py-4 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
          >
            <h3 className="text-sm font-semibold text-neutral-900">{card.title}</h3>
            <p className="mt-1 text-xs text-neutral-500">{card.body}</p>
          </Link>
        ))}
      </div>

      <OsPanel padded={false} className="mb-6">
        <div className="border-b border-neutral-100 px-4 py-3 text-sm font-semibold sm:px-5">
          Founding cohort workspace
        </div>
        <div className="divide-y divide-neutral-100">
          {byVendor.map((v) => (
            <div
              key={v.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5"
            >
              <div>
                <div className="font-medium text-neutral-900">{v.name}</div>
                <div className="text-xs text-neutral-500">
                  {v.neighbourhood} · {v.tagline}
                </div>
                {v.sample ? (
                  <div className="mt-1 text-[11px] text-neutral-400">
                    e.g. {v.sample.name} · {formatPrice(v.sample.price)}
                  </div>
                ) : null}
              </div>
              <div className="text-right">
                <div className="text-xs font-medium text-neutral-700">{v.skus} SKUs</div>
                <Link
                  href={`/shop?vendor=${encodeURIComponent(v.name)}`}
                  className="text-[11px] font-medium text-neutral-900 underline underline-offset-2"
                >
                  View on storefront
                </Link>
              </div>
            </div>
          ))}
        </div>
      </OsPanel>

      <OsPanel padded={false}>
        <div className="border-b border-neutral-100 px-4 py-3 text-sm font-semibold sm:px-5">
          Admitted vendors
        </div>
        {admitted.length ? (
          <div className="divide-y divide-neutral-100">
            {admitted.map((v) => (
              <div
                key={v.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm sm:px-5"
              >
                <div>
                  <div className="font-medium text-neutral-900">{v.businessName}</div>
                  <div className="text-xs text-neutral-500">
                    {v.neighbourhood} · {v.categories.join(", ") || "—"}
                  </div>
                </div>
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                  Admitted
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-5 py-8 text-center text-sm text-neutral-500">
            No admitted vendors yet.
          </p>
        )}
      </OsPanel>
    </ModuleShell>
  );
}
