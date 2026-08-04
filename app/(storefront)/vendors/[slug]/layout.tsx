"use client";

import { useParams } from "next/navigation";
import { VendorStoreProvider } from "@/components/storefront/VendorStoreContext";
import { VendorStoreShell } from "@/components/storefront/VendorStoreShell";

export default function VendorStoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const slug = String(params.slug || "");

  return (
    <VendorStoreProvider key={slug} slug={slug}>
      <VendorStoreShell>{children}</VendorStoreShell>
    </VendorStoreProvider>
  );
}
