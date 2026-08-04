"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useVendorStore } from "@/components/storefront/VendorStoreContext";

export default function VendorReviewsRedirect() {
  const router = useRouter();
  const { slug } = useVendorStore();

  useEffect(() => {
    if (!slug) return;
    router.replace(`/vendors/${slug}`);
  }, [router, slug]);

  return <p className="py-16 text-[13px] text-black/40">Loading…</p>;
}
