"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AccessControl from "@/components/admin/AccessControl";
import PageContainer, {
  AdminPageHeader,
} from "@/components/admin/PageContainer";
import CatalogueKpiStrip from "@/components/admin/catalogue/viz/CatalogueKpiStrip";
import { adminUi } from "@/components/admin/admin-ui";
import { cn } from "@/lib/utils";

type DiscoveryRow = {
  publicId: string;
  barcode: string | null;
  name: string | null;
  brand: string | null;
  provider: string;
  confidenceBand?: string | null;
  confidenceScore?: number | null;
  preview?: { completeness?: number | null };
};

export default function ConfidenceReviewQueuePage() {
  return (
    <AccessControl requiredPermission="products:view">
      <QueueInner />
    </AccessControl>
  );
}

function QueueInner() {
  const [band, setBand] = useState<"all" | "high" | "medium" | "low">("medium");
  const [items, setItems] = useState<DiscoveryRow[]>([]);
  const [counts, setCounts] = useState({
    high: 0,
    medium: 0,
    low: 0,
    unscored: 0,
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [intelRes, discRes] = await Promise.all([
        fetch("/api/admin/catalogue/intelligence"),
        fetch("/api/admin/catalogue/discovery?status=pending&limit=80"),
      ]);
      const intel = await intelRes.json();
      const disc = await discRes.json();
      if (intel.confidenceQueue) setCounts(intel.confidenceQueue);
      let rows = (disc.items || []) as DiscoveryRow[];
      // Prefer persisted band when present; fall back to completeness heuristic
      rows = rows.map((r) => {
        if (r.confidenceBand) return r;
        const c = r.preview?.completeness ?? 0;
        return {
          ...r,
          confidenceBand:
            c >= 70 ? "high" : c >= 40 ? "medium" : c > 0 ? "low" : null,
        };
      });
      if (band !== "all") {
        rows = rows.filter((r) => r.confidenceBand === band);
      }
      setItems(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [band]);

  useEffect(() => {
    void load();
  }, [load]);

  const runReconcile = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/catalogue/jobs/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 30 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Reconcile failed");
        return;
      }
      setMsg(
        `Scored ${data.summary?.discoveryScored || 0} · high ${data.summary?.highConfidence || 0} · duplicates ${data.summary?.duplicatePairs || 0}`,
      );
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageContainer>
      <AdminPageHeader
        title="Confidence review"
        description="Identity-resolution lanes by confidence. High can bulk-approve from Discovery; medium/low need human review."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void runReconcile()}
              className={adminUi.btnSecondary}
            >
              {busy ? "Reconciling…" : "Run reconciliation"}
            </button>
            <Link href="/admin/products/discovery" className={adminUi.btnPrimary}>
              Open discovery
            </Link>
          </div>
        }
      />

      <CatalogueKpiStrip
        items={[
          {
            label: "High",
            value: counts.high,
            active: band === "high",
            onClick: () => setBand("high"),
          },
          {
            label: "Medium",
            value: counts.medium,
            active: band === "medium",
            onClick: () => setBand("medium"),
          },
          {
            label: "Low",
            value: counts.low,
            active: band === "low",
            onClick: () => setBand("low"),
          },
          {
            label: "Unscored",
            value: counts.unscored,
            active: band === "all",
            onClick: () => setBand("all"),
          },
        ]}
      />

      {msg ? <p className="mt-3 text-[13px] text-emerald-800">{msg}</p> : null}
      {error ? <p className="mt-3 text-[13px] text-red-700">{error}</p> : null}

      <div className="mt-6 border border-black/10 bg-white">
        <div className="border-b border-black/10 px-4 py-2 text-[13px] font-medium">
          {loading ? "Loading…" : `${items.length} in ${band} lane`}
        </div>
        <ul className="divide-y divide-black/5">
          {items.map((item) => (
            <li
              key={item.publicId}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium">
                  {item.name || item.barcode || item.publicId}
                </p>
                <p className="text-[12px] text-black/45">
                  {item.brand || "—"} · {item.provider} ·{" "}
                  <span
                    className={cn(
                      "uppercase tracking-wide",
                      item.confidenceBand === "high" && "text-emerald-700",
                      item.confidenceBand === "medium" && "text-amber-700",
                      item.confidenceBand === "low" && "text-red-700",
                    )}
                  >
                    {item.confidenceBand || "unscored"}
                  </span>
                  {item.confidenceScore != null
                    ? ` (${item.confidenceScore})`
                    : ""}
                </p>
              </div>
              <Link
                href={`/admin/products/discovery`}
                className={adminUi.btnGhost}
                onClick={() => {
                  try {
                    sessionStorage.setItem(
                      "kc.discovery.focus",
                      item.publicId,
                    );
                  } catch {
                    /* ignore */
                  }
                }}
              >
                Review
              </Link>
            </li>
          ))}
          {!loading && !items.length ? (
            <li className="px-4 py-10 text-center text-[13px] text-black/40">
              Empty lane — run reconciliation to score pending candidates
            </li>
          ) : null}
        </ul>
      </div>
    </PageContainer>
  );
}
