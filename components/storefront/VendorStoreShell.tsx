"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { StorePage } from "@/components/marketplace/StorePage";
import { useVendorStore } from "./VendorStoreContext";
import { track } from "@/lib/track";

export function VendorStoreShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading, notFound, vendor } = useVendorStore();

  useEffect(() => {
    if (vendor) {
      track(
        "storefront.vendor_viewed",
        { vendor: vendor.name, slug: vendor.slug, path: pathname },
        "customer",
      );
    }
  }, [vendor, pathname]);

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#f7f7f5]">
        <Loader2 className="h-7 w-7 animate-spin text-black/40" />
      </div>
    );
  }

  if (notFound || !vendor) {
    return (
      <StorePage narrow>
        <div className="border-t border-black/[0.06] px-2 py-20 text-center sm:py-24">
          <h1 className="text-[clamp(1.75rem,6vw,2.5rem)] font-medium tracking-tight">
            Vendor not found
          </h1>
          <p className="mt-4 text-[15px] text-black/50 sm:text-[16px]">
            This shop isn’t approved or doesn’t exist.
          </p>
          <Link
            href="/brands"
            className="mt-8 inline-flex min-h-12 items-center bg-black px-8 py-3.5 text-[12px] font-medium uppercase tracking-[0.16em] text-white hover:opacity-80"
          >
            Browse vendors
          </Link>
        </div>
      </StorePage>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full bg-[#f7f7f5] text-black">
      {vendor.storefront.announcement ? (
        <div className="border-b border-black/10 bg-black px-4 py-2 text-center text-[10px] font-medium uppercase tracking-[0.16em] text-white sm:py-2.5 sm:text-[12px] sm:tracking-[0.18em]">
          {vendor.storefront.announcement}
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-[1600px] px-4 pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] pt-6 sm:px-10 sm:pb-16 sm:pt-12 lg:px-14 lg:pb-20 lg:pt-16 xl:px-20">
        {children}
      </div>
    </div>
  );
}
