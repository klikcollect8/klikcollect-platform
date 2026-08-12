"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import AccessControl from "@/components/admin/AccessControl";
import ScannerWorkspace from "@/components/admin/catalogue/scanner/ScannerWorkspace";

export default function CatalogueScannerPage() {
  return (
    <AccessControl requiredPermission="barcode:scan">
      <Suspense
        fallback={
          <div className="flex min-h-[60vh] items-center justify-center bg-black text-[14px] text-white/50">
            Loading scanner…
          </div>
        }
      >
        <ScannerPageInner />
      </Suspense>
    </AccessControl>
  );
}

function ScannerPageInner() {
  const searchParams = useSearchParams();
  const barcode = searchParams.get("barcode") || undefined;
  const discoveryId = searchParams.get("discovery") || undefined;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-black lg:left-[var(--admin-aside,260px)]">
      <ScannerWorkspace
        context="page"
        variant="page"
        initialBarcode={barcode}
        discoveryId={discoveryId}
        className="h-full"
      />
    </div>
  );
}
