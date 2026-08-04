"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useVendorStore } from "@/components/storefront/VendorStoreContext";

/** About removed - one-page store. */
export default function VendorAboutRedirect() {
  const router = useRouter();
  const { slug } = useVendorStore();

  useEffect(() => {
    if (!slug) return;
    router.replace(`/vendors/${slug}#visit`);
  }, [router, slug]);

  return <p className="py-16 text-[13px] text-black/40">Loading…</p>;
}
