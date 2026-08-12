"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AccessControl from "@/components/admin/AccessControl";
import PageContainer, {
  AdminPageHeader,
} from "@/components/admin/PageContainer";
import CatalogueKpiStrip from "@/components/admin/catalogue/viz/CatalogueKpiStrip";
import DistributionBar from "@/components/admin/catalogue/viz/DistributionBar";
import StatusDonut from "@/components/admin/catalogue/viz/StatusDonut";
import { adminUi } from "@/components/admin/admin-ui";

type IntelPayload = {
  quality: {
    kpis: {
      products: number;
      missingBarcode: number;
      failedLookups24h: number;
      scansToday: number;
      pendingDiscovery: number;
      successfulMatchesToday: number;
    };
    analytics: {
      scansByStatus: Array<{ key: string; label: string; value: number }>;
      providerHits: Array<{ provider: string; hits: number; misses: number }>;
      scansSeries: Array<{ day: string; value: number }>;
    };
  };
  sources: Array<{
    providerId: string;
    displayName: string;
    healthStatus: string;
    enabled: boolean;
  }>;
  jobs: Array<{
    id: string;
    job_type: string;
    status: string;
    started_at: string;
    summary?: Record<string, unknown>;
  }>;
  discoveryCounts: {
    pending: number;
    imported: number;
    dismissed: number;
  };
  confidenceQueue: {
    high: number;
    medium: number;
    low: number;
    unscored: number;
  };
  provenanceByProvider: Array<{ provider: string; count: number }>;
  enrichmentFills30d: number;
  funnel30d: {
    scanned: number;
    localFound: number;
    externalFound: number;
    notFound: number;
    committed: number;
  };
};

export default function IntelligenceAnalyticsPage() {
  return (
    <AccessControl requiredPermission="products:view">
      <AnalyticsInner />
    </AccessControl>
  );
}

function AnalyticsInner() {
  const [data, setData] = useState<IntelPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [jobMsg, setJobMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/catalogue/intelligence");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to load");
        return;
      }
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runJob = async (path: string, label: string) => {
    setBusy(true);
    setJobMsg(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || `${label} failed`);
        return;
      }
      setJobMsg(`${label} finished`);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const k = data?.quality.kpis;
  const funnel = data?.funnel30d;

  return (
    <PageContainer>
      <AdminPageHeader
        title="Intelligence analytics"
        description="Catalogue intelligence funnel, source health, enrichment coverage, and job history."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              className={adminUi.btnSecondary}
              onClick={() =>
                void runJob(
                  "/api/admin/catalogue/jobs/reconcile",
                  "Reconciliation",
                )
              }
            >
              Reconcile
            </button>
            <button
              type="button"
              disabled={busy}
              className={adminUi.btnSecondary}
              onClick={() =>
                void runJob("/api/admin/catalogue/jobs/enrich", "Enrichment")
              }
            >
              Auto-enrich
            </button>
            <Link href="/admin/products/quality" className={adminUi.btnGhost}>
              Quality Centre
            </Link>
          </div>
        }
      />

      {error ? <p className="mb-3 text-[13px] text-red-700">{error}</p> : null}
      {jobMsg ? (
        <p className="mb-3 text-[13px] text-emerald-800">{jobMsg}</p>
      ) : null}

      {k ? (
        <CatalogueKpiStrip
          items={[
            { label: "Products", value: k.products },
            { label: "Scans today", value: k.scansToday },
            { label: "Matches today", value: k.successfulMatchesToday },
            { label: "Pending discovery", value: k.pendingDiscovery },
            { label: "Failed 24h", value: k.failedLookups24h },
            {
              label: "Enrich fills 30d",
              value: data?.enrichmentFills30d || 0,
            },
          ]}
        />
      ) : (
        <p className="text-[13px] text-black/40">Loading…</p>
      )}

      {funnel ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <StatusDonut
            title="30d scan funnel"
            data={[
              { key: "local", label: "Local", value: funnel.localFound },
              {
                key: "external",
                label: "External",
                value: funnel.externalFound,
              },
              { key: "miss", label: "Not found", value: funnel.notFound },
              {
                key: "committed",
                label: "Committed",
                value: funnel.committed,
              },
            ]}
          />
          <DistributionBar
            title="Confidence queue"
            data={[
              {
                key: "high",
                label: "High",
                value: data?.confidenceQueue.high || 0,
              },
              {
                key: "medium",
                label: "Medium",
                value: data?.confidenceQueue.medium || 0,
              },
              {
                key: "low",
                label: "Low",
                value: data?.confidenceQueue.low || 0,
              },
              {
                key: "unscored",
                label: "Unscored",
                value: data?.confidenceQueue.unscored || 0,
              },
            ]}
          />
          <DistributionBar
            title="Field provenance"
            data={(data?.provenanceByProvider || []).map((p) => ({
              key: p.provider,
              label: p.provider,
              value: p.count,
            }))}
          />
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="border border-black/10 bg-white">
          <div className="border-b border-black/10 px-4 py-2 text-[13px] font-medium">
            Source health
          </div>
          <ul className="divide-y divide-black/5 text-[13px]">
            {(data?.sources || []).map((s) => (
              <li
                key={s.providerId}
                className="flex items-center justify-between px-4 py-2"
              >
                <span>{s.displayName}</span>
                <span className="text-[11px] uppercase tracking-wide text-black/45">
                  {s.enabled ? s.healthStatus : "disabled"}
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t border-black/10 px-4 py-2">
            <Link
              href="/admin/products/sources"
              className="text-[12px] underline"
            >
              Manage sources
            </Link>
          </div>
        </div>

        <div className="border border-black/10 bg-white">
          <div className="border-b border-black/10 px-4 py-2 text-[13px] font-medium">
            Recent jobs
          </div>
          <ul className="max-h-64 divide-y divide-black/5 overflow-y-auto text-[12px]">
            {(data?.jobs || []).map((j) => (
              <li key={j.id} className="px-4 py-2">
                <span className="font-medium">{j.job_type}</span> · {j.status} ·{" "}
                {new Date(j.started_at).toLocaleString("en-KE")}
              </li>
            ))}
            {!data?.jobs?.length ? (
              <li className="px-4 py-6 text-center text-black/40">
                No job runs yet
              </li>
            ) : null}
          </ul>
        </div>
      </div>

      {data?.quality.analytics.providerHits?.length ? (
        <div className="mt-6">
          <DistributionBar
            title="Provider hit / miss (7d)"
            data={data.quality.analytics.providerHits.map((p) => ({
              key: p.provider,
              label: p.provider,
              value: p.hits,
            }))}
          />
        </div>
      ) : null}
    </PageContainer>
  );
}
