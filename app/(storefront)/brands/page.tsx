"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { track } from "@/lib/track";
import { StorePage, StoreHeading } from "@/components/marketplace/StorePage";
import ThemeSelect from "@/components/ui/ThemeSelect";

type VendorRow = {
  id: string;
  name: string;
  neighbourhood: string;
  tagline: string;
  slug: string;
  productCount: number;
};

export default function BrandsPage() {
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [hood, setHood] = useState("all");

  useEffect(() => {
    track("storefront.vendors_viewed", { market: "Nairobi" }, "customer");
    fetch("/api/vendors")
      .then((r) => r.json())
      .then((payload) => {
        const rows = Array.isArray(payload?.data?.vendors)
          ? payload.data.vendors
          : [];
        setVendors(rows);
      })
      .catch(() => setVendors([]))
      .finally(() => setLoading(false));
  }, []);

  const neighbourhoods = useMemo(
    () => [...new Set(vendors.map((v) => v.neighbourhood))].sort(),
    [vendors],
  );

  const filtered = vendors.filter((v) => {
    const q = query.toLowerCase();
    const matchesQ =
      !q ||
      v.name.toLowerCase().includes(q) ||
      v.neighbourhood.toLowerCase().includes(q) ||
      v.tagline.toLowerCase().includes(q);
    return matchesQ && (hood === "all" || v.neighbourhood === hood);
  });

  return (
    <StorePage>
      <StoreHeading
        eyebrow="Sellers"
        title="Vendors"
        description={`${filtered.length} active`}
      />

      <div className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search brands"
            className="w-full border border-black/12 bg-transparent py-3 pl-11 pr-4 text-[14px] focus:border-black/40 focus:outline-none"
          />
        </div>
        <ThemeSelect
          value={hood}
          onValueChange={setHood}
          size="sm"
          triggerClassName="h-11 min-w-[9.5rem] px-4 text-[14px]"
          options={[
            { value: "all", label: "All areas" },
            ...neighbourhoods.map((n) => ({ value: n, label: n })),
          ]}
        />
      </div>

      {loading ? (
        <p className="border-t border-black/[0.06] py-16 text-[13px] text-black/40">
          Loading…
        </p>
      ) : filtered.length === 0 ? (
        <div className="border-t border-black/[0.06] py-20 text-center">
          <p className="text-[18px] font-medium">No approved vendors yet</p>
          <p className="mt-2 text-[15px] text-black/50">Check back soon.</p>
        </div>
      ) : (
        <div className="grid gap-0 border-t border-black/[0.06] sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((v) => (
            <Link
              key={v.id}
              href={`/vendors/${v.slug}`}
              className="border-b border-black/[0.06] px-0 py-8 transition-opacity hover:opacity-60 sm:border-r sm:px-8 lg:[&:nth-child(3n)]:border-r-0"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-[18px] font-medium tracking-tight">
                  {v.name}
                </h2>
                <span className="text-[11px] uppercase tracking-[0.14em] text-black/35">
                  Active
                </span>
              </div>
              <p className="mt-3 line-clamp-2 text-[14px] leading-relaxed text-black/50">
                {v.tagline}
              </p>
              <p className="mt-5 text-[12px] uppercase tracking-[0.14em] text-black/35">
                {v.neighbourhood}
              </p>
            </Link>
          ))}
        </div>
      )}
    </StorePage>
  );
}
