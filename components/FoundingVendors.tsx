"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";

type VendorRow = {
  id: string;
  name: string;
  slug: string;
  neighbourhood: string;
  tagline: string;
};

/** Homepage section — admitted vendors only, matches brands directory style */
export default function FoundingVendors() {
  const [vendors, setVendors] = useState<VendorRow[]>([]);

  useEffect(() => {
    fetch("/api/vendors")
      .then((r) => r.json())
      .then((payload) => {
        const rows = Array.isArray(payload?.data?.vendors)
          ? payload.data.vendors
          : [];
        setVendors(rows.slice(0, 6));
      })
      .catch(() => setVendors([]));
  }, []);

  if (!vendors.length) return null;

  return (
    <section className="w-full">
      <div className="mb-10 flex items-end justify-between gap-6">
        <div>
          <h2 className="text-[clamp(1.5rem,2.5vw,2rem)] font-medium tracking-tight text-black">
            Vendors near you
          </h2>
          <p className="mt-2 max-w-xl text-[15px] text-black/45">
            Approved shops ready for click &amp; collect.
          </p>
        </div>
        <Link
          href="/brands"
          className="shrink-0 text-[14px] font-medium underline underline-offset-[6px] decoration-black/25 hover:decoration-black"
        >
          View all →
        </Link>
      </div>

      <div className="grid gap-0 border-t border-black/[0.06] sm:grid-cols-2 lg:grid-cols-3">
        {vendors.map((v) => (
          <Link
            key={v.id}
            href={`/vendors/${v.slug}`}
            className="border-b border-black/[0.06] px-0 py-8 transition-opacity hover:opacity-60 sm:border-r sm:px-8 lg:[&:nth-child(3n)]:border-r-0"
          >
            <h3 className="text-[16px] font-medium tracking-tight">{v.name}</h3>
            <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-black/50">
              {v.tagline}
            </p>
            <p className="mt-4 flex items-center gap-1.5 text-[12px] uppercase tracking-[0.14em] text-black/35">
              <MapPin className="h-3 w-3" />
              {v.neighbourhood}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
