"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AccessControl from "@/components/admin/AccessControl";
import PageContainer, {
  AdminPageHeader,
} from "@/components/admin/PageContainer";
import { adminUi } from "@/components/admin/admin-ui";
import { cn } from "@/lib/utils";

type ProductBrief = {
  id: string;
  name: string;
  barcode?: string | null;
  gtin?: string | null;
  sku?: string | null;
  brandName?: string | null;
  status?: string;
  image?: string | null;
  offers?: Array<{
    id: string;
    vendorName?: string | null;
    priceMinor?: number;
    stock?: number;
  }>;
};

type Conflict = {
  field: string;
  target: string | null;
  source: string | null;
};

export default function ProductMergePage() {
  return (
    <AccessControl requiredPermission="products:edit">
      <MergeInner />
    </AccessControl>
  );
}

function MergeInner() {
  const [targetId, setTargetId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [qTarget, setQTarget] = useState("");
  const [qSource, setQSource] = useState("");
  const [targetHits, setTargetHits] = useState<ProductBrief[]>([]);
  const [sourceHits, setSourceHits] = useState<ProductBrief[]>([]);
  const [target, setTarget] = useState<ProductBrief | null>(null);
  const [source, setSource] = useState<ProductBrief | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [choices, setChoices] = useState<Record<string, "target" | "source">>(
    {},
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const search = useCallback(async (q: string, which: "target" | "source") => {
    if (q.trim().length < 2) {
      if (which === "target") setTargetHits([]);
      else setSourceHits([]);
      return;
    }
    const params = new URLSearchParams({ q: q.trim(), pageSize: "8" });
    const res = await fetch(`/api/admin/catalogue/products?${params}`);
    const data = await res.json();
    const items = (data.items || data.products || []) as ProductBrief[];
    if (which === "target") setTargetHits(items);
    else setSourceHits(items);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void search(qTarget, "target"), 280);
    return () => clearTimeout(t);
  }, [qTarget, search]);

  useEffect(() => {
    const t = setTimeout(() => void search(qSource, "source"), 280);
    return () => clearTimeout(t);
  }, [qSource, search]);

  const loadPreview = async (tId: string, sId: string) => {
    setError(null);
    setDone(null);
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/catalogue/merge?target=${encodeURIComponent(tId)}&source=${encodeURIComponent(sId)}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not load merge preview");
        return;
      }
      setTarget(data.target);
      setSource(data.source);
      setTargetId(tId);
      setSourceId(sId);
      setConflicts(data.conflicts || []);
      const next: Record<string, "target" | "source"> = {};
      for (const c of data.conflicts || []) next[c.field] = "target";
      setChoices(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!targetId || !sourceId) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const res = await fetch("/api/admin/catalogue/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetPublicId: targetId,
          sourcePublicId: sourceId,
          reason,
          fieldChoices: Object.entries(choices).map(([field, pick]) => ({
            field,
            fromSource: pick === "source",
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Merge failed");
        return;
      }
      setDone(
        `Merged. Offers moved ${data.offersMoved}, merged ${data.offersMerged}. Source archived.`,
      );
      setSource(null);
      setSourceId("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Merge failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageContainer>
      <AdminPageHeader
        title="Merge products"
        description="Keep one canonical product. Offers move to the survivor; the loser is archived."
      />

      {error ? (
        <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">
          {error}
        </p>
      ) : null}
      {done ? (
        <p className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-900">
          {done}{" "}
          <Link href={`/admin/products/${targetId}`} className="underline">
            Open survivor
          </Link>
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <PickColumn
          label="Survivor (keep)"
          q={qTarget}
          setQ={setQTarget}
          hits={targetHits}
          selected={target}
          onPick={(p) => {
            setTargetId(p.id);
            setTarget(p);
            if (sourceId) void loadPreview(p.id, sourceId);
          }}
        />
        <PickColumn
          label="Loser (archive)"
          q={qSource}
          setQ={setQSource}
          hits={sourceHits}
          selected={source}
          onPick={(p) => {
            setSourceId(p.id);
            setSource(p);
            if (targetId) void loadPreview(targetId, p.id);
          }}
        />
      </div>

      {target && source ? (
        <div className="mt-8 space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <SideCard title="Survivor" product={target} />
            <SideCard title="Loser" product={source} />
          </div>

          {conflicts.length ? (
            <div className="border border-black/10 bg-white">
              <div className="border-b border-black/10 px-4 py-3">
                <p className="text-[13px] font-medium">Field conflicts</p>
                <p className="text-[12px] text-black/45">
                  Choose which value to keep on the survivor.
                </p>
              </div>
              <div className="divide-y divide-black/5">
                {conflicts.map((c) => (
                  <div
                    key={c.field}
                    className="grid gap-2 px-4 py-3 sm:grid-cols-[140px_1fr_1fr]"
                  >
                    <p className="text-[12px] font-medium uppercase tracking-wide text-black/40">
                      {c.field}
                    </p>
                    <label className="flex cursor-pointer gap-2 text-[13px]">
                      <input
                        type="radio"
                        name={`f-${c.field}`}
                        checked={choices[c.field] !== "source"}
                        onChange={() =>
                          setChoices((prev) => ({
                            ...prev,
                            [c.field]: "target",
                          }))
                        }
                      />
                      <span>{c.target}</span>
                    </label>
                    <label className="flex cursor-pointer gap-2 text-[13px]">
                      <input
                        type="radio"
                        name={`f-${c.field}`}
                        checked={choices[c.field] === "source"}
                        onChange={() =>
                          setChoices((prev) => ({
                            ...prev,
                            [c.field]: "source",
                          }))
                        }
                      />
                      <span>{c.source}</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-black/45">
              No conflicting identity fields — offers will still be reassigned.
            </p>
          )}

          <div>
            <label className={adminUi.sectionLabel}>Reason (optional)</label>
            <input
              className={adminUi.input}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Duplicate catalogue entries"
            />
          </div>

          <button
            type="button"
            disabled={busy || !targetId || !sourceId}
            onClick={() => void commit()}
            className={cn(adminUi.btnPrimary, "disabled:opacity-40")}
          >
            {busy ? "Merging…" : "Merge into survivor"}
          </button>
        </div>
      ) : null}
    </PageContainer>
  );
}

function PickColumn({
  label,
  q,
  setQ,
  hits,
  selected,
  onPick,
}: {
  label: string;
  q: string;
  setQ: (v: string) => void;
  hits: ProductBrief[];
  selected: ProductBrief | null;
  onPick: (p: ProductBrief) => void;
}) {
  return (
    <div className="border border-black/10 bg-white p-4">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-black/40">
        {label}
      </p>
      <input
        className={adminUi.input}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search name, barcode, SKU…"
      />
      <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
        {hits.map((h) => (
          <button
            key={h.id}
            type="button"
            onClick={() => onPick(h)}
            className={cn(
              "flex w-full flex-col items-start border px-3 py-2 text-left text-[13px]",
              selected?.id === h.id
                ? "border-black bg-black/[0.03]"
                : "border-transparent hover:bg-black/[0.02]",
            )}
          >
            <span className="font-medium">{h.name}</span>
            <span className="text-[11px] text-black/40">
              {h.barcode || h.gtin || "no barcode"} · {h.id}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SideCard({
  title,
  product,
}: {
  title: string;
  product: ProductBrief;
}) {
  return (
    <div className="border border-black/10 bg-white p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-black/40">
        {title}
      </p>
      <p className="mt-2 text-[16px] font-medium">{product.name}</p>
      <p className="mt-1 text-[12px] text-black/45">
        {product.brandName || "—"} · {product.barcode || "no barcode"} ·{" "}
        {product.status}
      </p>
      <p className="mt-3 text-[12px] text-black/50">
        {(product.offers || []).length} offer(s)
      </p>
      <ul className="mt-1 space-y-1 text-[12px] text-black/55">
        {(product.offers || []).slice(0, 6).map((o) => (
          <li key={o.id}>
            {o.vendorName || "Vendor"} · stock {o.stock ?? "—"}
          </li>
        ))}
      </ul>
    </div>
  );
}
