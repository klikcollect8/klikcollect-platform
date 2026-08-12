"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  Package,
  ScanBarcode,
} from "lucide-react";
import AccessControl from "@/components/admin/AccessControl";
import PageContainer, {
  AdminPageHeader,
} from "@/components/admin/PageContainer";
import CatalogueKpiStrip from "@/components/admin/catalogue/viz/CatalogueKpiStrip";
import DistributionBar from "@/components/admin/catalogue/viz/DistributionBar";
import StatusDonut from "@/components/admin/catalogue/viz/StatusDonut";
import { adminUi } from "@/components/admin/admin-ui";
import { cn } from "@/lib/utils";

type QualityData = {
  kpis: {
    products: number;
    missingBarcode: number;
    missingImage: number;
    failedLookups24h: number;
    scansToday: number;
    successfulMatchesToday: number;
    pendingDiscovery: number;
  };
  failedLookups: Array<{
    barcode: string;
    format: string | null;
    resolutionStatus: string;
    createdAt: string;
    attempts: number;
  }>;
  missingBarcodes: Array<{
    id: string;
    name: string;
    status: string;
  }>;
  incomplete: Array<{
    id: string;
    name: string;
    status: string;
    issues: string[];
  }>;
  duplicates: Array<{
    publicId: string;
    name: string;
    barcode: string | null;
    reason: string;
  }>;
  lowConfidenceDiscovery: Array<{
    publicId: string;
    name: string | null;
    barcode: string | null;
    provider: string;
    completeness: number | null;
  }>;
  analytics: {
    scansByStatus: Array<{ key: string; label: string; value: number }>;
    topBarcodes: Array<{ barcode: string; count: number }>;
    providerHits: Array<{ provider: string; hits: number; misses: number }>;
    scansSeries: Array<{ day: string; value: number }>;
  };
};

function QueueSection({
  title,
  children,
  href,
  hrefLabel,
}: {
  title: string;
  children: React.ReactNode;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <section className="space-y-3 border-b border-black/10 pb-6">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-[11px] uppercase tracking-[0.14em] text-black/40">
          {title}
        </h2>
        {href ? (
          <Link href={href} className="text-[12px] text-black/45 underline-offset-2 hover:underline">
            {hrefLabel || "Open"}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export default function QualityCentrePage() {
  return (
    <AccessControl requiredPermission="products:view">
      <QualityInner />
    </AccessControl>
  );
}

function QualityInner() {
  const [data, setData] = useState<QualityData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/catalogue/quality");
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || "Failed to load");
          return;
        }
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const k = data?.kpis;

  return (
    <PageContainer>
      <AdminPageHeader
        title="Quality Centre"
        description="Catalogue health, failed lookups, duplicates, and scan intelligence."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/products/scanner"
              className={cn(adminUi.btnPrimary, "inline-flex items-center gap-2")}
            >
              <ScanBarcode className="h-4 w-4" />
              Scanner
            </Link>
            <Link href="/admin/products/discovery" className={adminUi.btnGhost}>
              Discovery
            </Link>
            <Link href="/admin/products" className={adminUi.btnGhost}>
              Catalogue
            </Link>
          </div>
        }
      />

      {error ? <p className="text-[12px] text-red-700">{error}</p> : null}
      {loading && !data ? (
        <p className="text-[13px] text-black/45">Loading quality queues…</p>
      ) : null}

      {k ? (
        <CatalogueKpiStrip
          items={[
            {
              label: "Scans today",
              value: k.scansToday,
              description: `${k.successfulMatchesToday} matched`,
              icon: ScanBarcode,
            },
            {
              label: "Failed (24h)",
              value: k.failedLookups24h,
              icon: AlertTriangle,
            },
            {
              label: "Missing barcodes",
              value: k.missingBarcode,
              icon: Package,
            },
            {
              label: "Discovery queue",
              value: k.pendingDiscovery,
              icon: BarChart3,
            },
          ]}
        />
      ) : null}

      {data ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <StatusDonut
            title="Scan outcomes (7d)"
            data={data.analytics.scansByStatus}
          />
          <DistributionBar
            title="Scan volume"
            data={data.analytics.scansSeries.map((s) => ({
              key: s.day,
              label: s.day,
              value: s.value,
            }))}
          />
          <DistributionBar
            title="Provider hits"
            data={data.analytics.providerHits.map((p) => ({
              key: p.provider,
              label: p.provider.replace(/_/g, " "),
              value: p.hits,
            }))}
            layout="vertical"
          />
        </div>
      ) : null}

      {data ? (
        <div className="mt-10 space-y-8">
          <QueueSection
            title="Failed lookups"
            href="/admin/products/scanner"
            hrefLabel="Retry in scanner"
          >
            {!data.failedLookups.length ? (
              <p className="text-[12px] text-black/40">No recent failures.</p>
            ) : (
              <ul className="divide-y divide-black/[0.05]">
                {data.failedLookups.map((f) => (
                  <li
                    key={`${f.barcode}-${f.createdAt}`}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 text-[12px]"
                  >
                    <div>
                      <p className="font-mono text-black">{f.barcode}</p>
                      <p className="text-[11px] text-black/40">
                        {f.resolutionStatus.replace(/_/g, " ")} · {f.attempts}×
                      </p>
                    </div>
                    <Link
                      href={`/admin/products/scanner?barcode=${encodeURIComponent(f.barcode)}`}
                      className={adminUi.btnGhost}
                    >
                      Retry
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </QueueSection>

          <QueueSection title="Missing barcodes" href="/admin/products?missingBarcode=1">
            {!data.missingBarcodes.length ? (
              <p className="text-[12px] text-black/40">All listed products have barcodes.</p>
            ) : (
              <ul className="divide-y divide-black/[0.05]">
                {data.missingBarcodes.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2 py-2 text-[12px]">
                    <span className="truncate font-medium">{p.name}</span>
                    <Link href={`/admin/products/${p.id}`} className={adminUi.btnGhost}>
                      Fix
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </QueueSection>

          <QueueSection title="Incomplete records">
            {!data.incomplete.length ? (
              <p className="text-[12px] text-black/40">No incomplete samples.</p>
            ) : (
              <ul className="divide-y divide-black/[0.05]">
                {data.incomplete.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2 py-2 text-[12px]">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="text-[11px] text-black/40">
                        Missing {p.issues.join(", ")}
                      </p>
                    </div>
                    <Link href={`/admin/products/${p.id}`} className={adminUi.btnGhost}>
                      Open
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </QueueSection>

          <QueueSection
            title="Duplicate candidates"
            href="/admin/products/discovery"
          >
            {!data.duplicates.length ? (
              <p className="text-[12px] text-black/40">No duplicates from current sample.</p>
            ) : (
              <ul className="divide-y divide-black/[0.05]">
                {data.duplicates.map((d) => (
                  <li key={`${d.publicId}-${d.reason}`} className="flex justify-between gap-2 py-2 text-[12px]">
                    <div>
                      <p className="font-medium">{d.name}</p>
                      <p className="text-[11px] text-black/40">{d.reason}</p>
                    </div>
                    <Link href={`/admin/products/${d.publicId}`} className={adminUi.btnGhost}>
                      View
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </QueueSection>

          <QueueSection
            title="Low-confidence discovery"
            href="/admin/products/discovery"
          >
            {!data.lowConfidenceDiscovery.length ? (
              <p className="text-[12px] text-black/40">Queue looks healthy.</p>
            ) : (
              <ul className="divide-y divide-black/[0.05]">
                {data.lowConfidenceDiscovery.map((d) => (
                  <li key={d.publicId} className="flex justify-between gap-2 py-2 text-[12px]">
                    <div>
                      <p className="font-medium">{d.name || d.barcode || "Untitled"}</p>
                      <p className="text-[11px] text-black/40">
                        {d.provider} · completeness {d.completeness ?? "—"}%
                      </p>
                    </div>
                    <Link
                      href="/admin/products/discovery"
                      className={adminUi.btnGhost}
                    >
                      Review
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </QueueSection>

          <QueueSection title="Most scanned barcodes">
            <ul className="divide-y divide-black/[0.05]">
              {data.analytics.topBarcodes.map((t) => (
                <li key={t.barcode} className="flex justify-between py-2 font-mono text-[12px]">
                  <span>{t.barcode}</span>
                  <span className="tabular-nums text-black/45">{t.count}</span>
                </li>
              ))}
              {!data.analytics.topBarcodes.length ? (
                <li className="py-2 text-[12px] text-black/40">No scan data yet.</li>
              ) : null}
            </ul>
          </QueueSection>
        </div>
      ) : null}
    </PageContainer>
  );
}
