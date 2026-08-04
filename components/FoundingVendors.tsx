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

/** Homepage section - admitted vendors only, matches brands directory style */
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
      <div className="mb-6 flex items-end justify-between gap-3 sm:mb-10 sm:gap-6">
        <div className="min-w-0">
          <h2 className="text-[clamp(1.35rem,5vw,2rem)] font-medium tracking-tight text-black">
            Vendors near you
          </h2>
          <p className="mt-1.5 max-w-xl text-[13px] text-black/45 sm:mt-2 sm:text-[15px]">
            Approved shops ready for click &amp; collect.
          </p>
        </div>
        <Link
          href="/brands"
          className="shrink-0 pb-0.5 text-[13px] font-medium underline underline-offset-[6px] decoration-black/25 hover:decoration-black sm:text-[14px]"
        >
          All →
        </Link>
      </div>

      {/* Mobile: horizontal snap rail */}
      <div className="scrollbar-hide -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:hidden">
        {vendors.map((v) => (
          <Link
            key={v.id}
            href={`/vendors/${v.slug}`}
            className="flex w-[min(78vw,18rem)] shrink-0 snap-start flex-col justify-between border border-black/[0.08] px-4 py-5 transition-opacity active:opacity-60"
          >
            <div>
              <h3 className="text-[16px] font-medium tracking-tight leading-snug">
                {v.name}
              </h3>
              {v.tagline ? (
                <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-black/50">
                  {v.tagline}
                </p>
              ) : null}
            </div>
            {v.neighbourhood ? (
              <p className="mt-5 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-black/35">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{v.neighbourhood}</span>
              </p>
            ) : null}
          </Link>
        ))}
      </div>

      {/* Tablet / desktop: grid */}
      <div className="hidden border-t border-black/[0.06] sm:grid sm:grid-cols-2 lg:grid-cols-3">
        {vendors.map((v) => (
          <Link
            key={v.id}
            href={`/vendors/${v.slug}`}
            className="border-b border-black/[0.06] px-6 py-8 transition-opacity hover:opacity-60 sm:border-r sm:px-8 lg:[&:nth-child(3n)]:border-r-0"
          >
            <h3 className="text-[16px] font-medium tracking-tight">{v.name}</h3>
            {v.tagline ? (
              <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-black/50">
                {v.tagline}
              </p>
            ) : null}
            {v.neighbourhood ? (
              <p className="mt-4 flex items-center gap-1.5 text-[12px] uppercase tracking-[0.14em] text-black/35">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{v.neighbourhood}</span>
              </p>
            ) : null}
          </Link>
        ))}
      </div>
    </section>
  );
}
