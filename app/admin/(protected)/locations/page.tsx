"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, MapPin, Move, ShieldQuestion } from "lucide-react";
import AccessControl from "@/components/admin/AccessControl";
import PageContainer, {
  AdminPageHeader,
} from "@/components/admin/PageContainer";
import CatalogueKpiStrip from "@/components/admin/catalogue/viz/CatalogueKpiStrip";
import { adminUi } from "@/components/admin/admin-ui";
import { googleMapsCoordsUrl } from "@/lib/external-maps";
import { cn } from "@/lib/utils";

type BranchIssue = {
  id: string;
  publicId: string | null;
  name: string;
  vendorName: string | null;
  lat: number | null;
  lng: number | null;
  neighbourhood: string | null;
  address: string | null;
  verified: boolean;
  confidence: string | null;
  updatedAt: string | null;
  issues: string[];
};

type QualityData = {
  kpis: {
    branches: number;
    missing: number;
    suspicious: number;
    unverified: number;
    duplicates: number;
    corrections30d: number;
    lowConfidenceOrders: number;
  };
  branches: {
    missing: BranchIssue[];
    suspicious: BranchIssue[];
    unverified: BranchIssue[];
    duplicates: BranchIssue[];
  };
  corrections: Array<{
    id: string;
    context: string;
    providerLat: number;
    providerLng: number;
    correctedLat: number;
    correctedLng: number;
    providerLabel: string | null;
    distanceM: number;
    createdAt: string;
  }>;
  lowConfidenceOrders: Array<{
    orderId: string;
    orderNumber: string | null;
    lat: number;
    lng: number;
    confidence: string | null;
    landmark: string | null;
    createdAt: string;
  }>;
};

type MetricsData = {
  ops: Record<
    string,
    {
      attempts: number;
      successes: number;
      failures: number;
      cacheHits: number;
      avgLatencyMs: number;
      successRate: number;
    }
  >;
  sessionsReported: number;
  since: string;
};

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 border-b border-black/10 pb-6">
      <h2 className="text-[11px] uppercase tracking-[0.14em] text-black/40">
        {title}
        {typeof count === "number" ? (
          <span className="ml-2 text-black/60">{count}</span>
        ) : null}
      </h2>
      {children}
    </section>
  );
}

function CoordsLink({ lat, lng }: { lat: number | null; lng: number | null }) {
  if (lat == null || lng == null) return null;
  return (
    <a
      href={googleMapsCoordsUrl({ lat, lng })}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono text-[11px] text-black/50 underline underline-offset-2 hover:text-black"
    >
      {lat.toFixed(5)}, {lng.toFixed(5)}
    </a>
  );
}

function BranchList({
  branches,
  empty,
}: {
  branches: BranchIssue[];
  empty: string;
}) {
  if (!branches.length) {
    return <p className="text-[12px] text-black/40">{empty}</p>;
  }
  return (
    <ul className="divide-y divide-black/[0.05]">
      {branches.map((b) => (
        <li
          key={`${b.id}-${b.issues[0] || ""}`}
          className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[12px]"
        >
          <div className="min-w-0">
            <p className="font-medium text-black">
              {b.name}
              {b.vendorName ? (
                <span className="ml-2 font-normal text-black/40">
                  {b.vendorName}
                </span>
              ) : null}
            </p>
            <p className="mt-0.5 text-[11px] text-black/45">
              {b.issues.join(" · ")}
            </p>
            {b.address || b.neighbourhood ? (
              <p className="mt-0.5 truncate text-[11px] text-black/35">
                {[b.neighbourhood, b.address].filter(Boolean).join(" · ")}
              </p>
            ) : null}
          </div>
          <CoordsLink lat={b.lat} lng={b.lng} />
        </li>
      ))}
    </ul>
  );
}

export default function LocationQualityPage() {
  return (
    <AccessControl requiredPermission="vendors:view">
      <LocationQualityInner />
    </AccessControl>
  );
}

function LocationQualityInner() {
  const [data, setData] = useState<QualityData | null>(null);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const [qualityRes, metricsRes] = await Promise.all([
          fetch("/api/admin/locations/quality"),
          fetch("/api/location/metrics"),
        ]);
        const qualityJson = await qualityRes.json();
        if (!qualityRes.ok) {
          setError(qualityJson.error || "Failed to load");
          return;
        }
        setData(qualityJson);
        if (metricsRes.ok) {
          setMetrics(await metricsRes.json());
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const k = data?.kpis;
  const metricOps = metrics ? Object.entries(metrics.ops) : [];

  return (
    <PageContainer>
      <AdminPageHeader
        title="Location Quality"
        description="Vendor branch pins, pin corrections, and low-confidence delivery locations across the marketplace."
      />

      {error ? <p className="text-[12px] text-red-700">{error}</p> : null}
      {loading && !data ? (
        <p className="text-[13px] text-black/45">Loading location queues…</p>
      ) : null}

      {k ? (
        <CatalogueKpiStrip
          items={[
            {
              label: "Branches",
              value: k.branches,
              description: `${k.missing} without a pin`,
              icon: MapPin,
            },
            {
              label: "Suspicious pins",
              value: k.suspicious,
              icon: AlertTriangle,
            },
            {
              label: "Unverified pins",
              value: k.unverified,
              icon: ShieldQuestion,
            },
            {
              label: "Corrections (30d)",
              value: k.corrections30d,
              description: `${k.lowConfidenceOrders} low-confidence orders`,
              icon: Move,
            },
          ]}
        />
      ) : null}

      {data ? (
        <div className="mt-10 space-y-8">
          <Section title="Branches without a pin" count={k?.missing}>
            <BranchList
              branches={data.branches.missing}
              empty="Every branch has coordinates."
            />
          </Section>

          <Section
            title="Suspicious or out-of-Kenya pins"
            count={k?.suspicious}
          >
            <BranchList
              branches={data.branches.suspicious}
              empty="No placeholder or out-of-country pins."
            />
          </Section>

          <Section title="Possible duplicate branches" count={k?.duplicates}>
            <BranchList
              branches={data.branches.duplicates}
              empty="No branches within 30 m of a sibling."
            />
          </Section>

          <Section title="Unverified pins" count={k?.unverified}>
            <p className="text-[12px] text-black/40">
              Coordinates set but never confirmed on a map by the vendor.
            </p>
            <BranchList
              branches={data.branches.unverified}
              empty="All pinned branches are map-verified."
            />
          </Section>

          <Section title="Recent pin corrections" count={data.corrections.length}>
            {!data.corrections.length ? (
              <p className="text-[12px] text-black/40">
                No corrections recorded yet. Corrections appear when users move
                a pin more than 25 m away from a geocoded address.
              </p>
            ) : (
              <ul className="divide-y divide-black/[0.05]">
                {data.corrections.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[12px]"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-black">
                        Moved {Math.round(c.distanceM)} m
                        <span className="ml-2 rounded-full border border-black/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-black/45">
                          {c.context.replace(/_/g, " ")}
                        </span>
                      </p>
                      {c.providerLabel ? (
                        <p className="mt-0.5 truncate text-[11px] text-black/45">
                          {c.providerLabel}
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-[11px] text-black/35">
                        {new Date(c.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 text-right">
                      <span className="text-[10px] uppercase tracking-wide text-black/35">
                        Geocoded → corrected
                      </span>
                      <CoordsLink lat={c.providerLat} lng={c.providerLng} />
                      <CoordsLink lat={c.correctedLat} lng={c.correctedLng} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Low-confidence delivery locations"
            count={data.lowConfidenceOrders.length}
          >
            {!data.lowConfidenceOrders.length ? (
              <p className="text-[12px] text-black/40">
                No recent orders with low-confidence delivery points.
              </p>
            ) : (
              <ul className="divide-y divide-black/[0.05]">
                {data.lowConfidenceOrders.map((o) => (
                  <li
                    key={o.orderId}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[12px]"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-black">
                        {o.orderNumber || o.orderId}
                        <span
                          className={cn(
                            "ml-2 rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-wide",
                            o.confidence === "low" || o.confidence === "manual"
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-red-200 bg-red-50 text-red-700",
                          )}
                        >
                          {o.confidence || "invalid pin"}
                        </span>
                      </p>
                      {o.landmark ? (
                        <p className="mt-0.5 truncate text-[11px] text-black/45">
                          Landmark: {o.landmark}
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-[11px] text-black/35">
                        {new Date(o.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <CoordsLink lat={o.lat} lng={o.lng} />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Provider metrics (since last deploy)">
            {!metricOps.length ? (
              <p className="text-[12px] text-black/40">
                No client sessions have reported location-provider metrics yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-[0.12em] text-black/35">
                      <th className="py-2 pr-4 font-medium">Operation</th>
                      <th className="py-2 pr-4 font-medium">Attempts</th>
                      <th className="py-2 pr-4 font-medium">Success</th>
                      <th className="py-2 pr-4 font-medium">Cache hits</th>
                      <th className="py-2 font-medium">Avg latency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.05]">
                    {metricOps.map(([op, s]) => (
                      <tr key={op}>
                        <td className="py-2 pr-4 font-medium text-black">
                          {op.replace(/_/g, " ")}
                        </td>
                        <td className="py-2 pr-4 tabular-nums">{s.attempts}</td>
                        <td className="py-2 pr-4 tabular-nums">
                          {Math.round(s.successRate * 100)}%
                        </td>
                        <td className="py-2 pr-4 tabular-nums">
                          {s.cacheHits}
                        </td>
                        <td className="py-2 tabular-nums">{s.avgLatencyMs} ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-[11px] text-black/35">
                  Aggregated best-effort from {metrics?.sessionsReported}{" "}
                  client session flushes since{" "}
                  {metrics ? new Date(metrics.since).toLocaleString() : "-"}.
                  In-memory only — resets on deploy.
                </p>
              </div>
            )}
          </Section>
        </div>
      ) : null}
    </PageContainer>
  );
}
