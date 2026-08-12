"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import AccessControl from "@/components/admin/AccessControl";
import PageContainer, {
  AdminPageHeader,
} from "@/components/admin/PageContainer";
import ScannerWorkspace from "@/components/admin/catalogue/scanner/ScannerWorkspace";
import Link from "next/link";
import { adminUi } from "@/components/admin/admin-ui";

export default function CatalogueScannerPage() {
  return (
    <AccessControl requiredPermission="barcode:scan">
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center text-[14px] text-black/45">
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
    <PageContainer>
      <AdminPageHeader
        title="Product scanner"
        description="Search or scan a barcode, review the visual board, then add it to the catalogue."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/products" className={adminUi.btnGhost}>
              Catalogue
            </Link>
            <Link href="/admin/products/discovery" className={adminUi.btnGhost}>
              Discovery
            </Link>
          </div>
        }
      />
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <ScannerWorkspace
          context="page"
          variant="page"
          initialBarcode={barcode}
          discoveryId={discoveryId}
          className="min-h-[75vh]"
        />
      </div>
    </PageContainer>
  );
}
