"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  PackagePlus,
  ScanBarcode,
  Search,
} from "lucide-react";
import AccessControl from "@/components/admin/AccessControl";
import PageContainer, {
  AdminPageHeader,
} from "@/components/admin/PageContainer";
import SlideOver from "@/components/admin/SlideOver";
import DiscoveryReviewPanel from "@/components/admin/catalogue/DiscoveryReviewPanel";
import ProductDataVisual from "@/components/admin/catalogue/ProductDataVisual";
import CatalogueKpiStrip from "@/components/admin/catalogue/viz/CatalogueKpiStrip";
import DistributionBar from "@/components/admin/catalogue/viz/DistributionBar";
import StatusDonut from "@/components/admin/catalogue/viz/StatusDonut";
import {
  completenessBuckets,
  countByKey,
  nutriscoreBuckets,
} from "@/components/admin/catalogue/viz/aggregate";
import { adminUi } from "@/components/admin/admin-ui";
import ThemeSelect from "@/components/ui/ThemeSelect";
import { openProductScanner } from "@/lib/admin/product-scanner-events";
import type {
  CandidateProduct,
  DiscoveryCandidateRow,
  DiscoveryStatusCounts,
} from "@/lib/product-resolver/types";
import { cn } from "@/lib/utils";

type StatusTab = "pending" | "imported" | "dismissed";

type RelatedHit = {
  barcode: string;
  name: string | null;
  brand: string | null;
  image: string | null;
  provider: string;
  inCatalogue: boolean;
  quantity?: string | null;
  nutriscore?: string | null;
  categoryHint?: string | null;
  temporary: true;
};

type ReviewTarget = {
  barcode: string;
  discoveryId?: string | null;
  seed?: DiscoveryCandidateRow | null;
  related?: RelatedHit | null;
};

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const mins = Math.round((Date.now() - t) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function ProductDiscoveryPage() {
  return (
    <AccessControl requiredPermission="products:view">
      <DiscoveryWorkspace />
    </AccessControl>
  );
}

function DiscoveryWorkspace() {
  const [items, setItems] = useState<DiscoveryCandidateRow[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<DiscoveryStatusCounts>({
    pending: 0,
    imported: 0,
    dismissed: 0,
  });
  const [brands, setBrands] = useState<string[]>([]);
  const [status, setStatus] = useState<StatusTab>("pending");
  const [q, setQ] = useState("");
  const [source, setSource] = useState("");
  const [brand, setBrand] = useState("");
  const [provider, setProvider] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [related, setRelated] = useState<RelatedHit[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [slideItem, setSlideItem] = useState<DiscoveryCandidateRow | null>(null);
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focusIndex, setFocusIndex] = useState(0);
  const [defaultCategoryId, setDefaultCategoryId] = useState("");
  const [categories, setCategories] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [approveMsg, setApproveMsg] = useState<string | null>(null);
  const prevQRef = useRef(q);

  const openReview = (target: ReviewTarget) => {
    setSlideItem(null);
    setReviewTarget(target);
  };

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/catalogue/meta");
        const data = await res.json();
        const cats = (data.categories || []).map(
          (c: { id?: string; public_id?: string; name: string }) => ({
            id: c.public_id || c.id || "",
            name: c.name,
          }),
        );
        setCategories(cats);
        if (cats[0]?.id) setDefaultCategoryId(cats[0].id);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const query = q.trim();
    if (query.length >= 2 && status === "pending") setRelatedLoading(true);
    else setRelated([]);
    try {
      const params = new URLSearchParams({ status, limit: "80" });
      if (query) params.set("q", query);
      if (source) params.set("source", source);
      if (brand) params.set("brand", brand);
      if (provider) params.set("provider", provider);
      const [listRes, brandsRes] = await Promise.all([
        fetch(`/api/admin/catalogue/discovery?${params}`),
        fetch(
          `/api/admin/catalogue/discovery?meta=brands&status=${encodeURIComponent(status)}`,
        ),
      ]);
      const data = await listRes.json();
      const brandsData = await brandsRes.json();
      if (!listRes.ok) {
        setError(data.error || "Failed to load");
        return;
      }
      setItems(data.items || []);
      setTotal(data.total || 0);
      if (data.counts) setCounts(data.counts);
      setBrands(brandsData.brands || []);
      setRelated(Array.isArray(data.related) ? data.related : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
      setRelatedLoading(false);
    }
  }, [status, q, source, brand, provider]);

  useEffect(() => {
    if (prevQRef.current === q) return;
    prevQRef.current = q;
    setRelated([]);
    setSelected(new Set());
  }, [q]);

  useEffect(() => {
    const delay = q.trim().length >= 2 ? 450 : 200;
    const t = setTimeout(() => void load(), delay);
    return () => clearTimeout(t);
  }, [load, q]);

  const patchOne = async (id: string, action: "dismiss" | "restore") => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/catalogue/discovery", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          (data as { error?: string }).error ||
            `Could not ${action} — you may need products:create`,
        );
        return;
      }
      if (slideItem?.publicId === id) setSlideItem(null);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Could not ${action}`);
    } finally {
      setBusy(false);
    }
  };

  const patchMany = async (ids: string[], action: "dismiss" | "restore") => {
    if (!ids.length) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/catalogue/discovery", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          (data as { error?: string }).error ||
            `Could not ${action} — you may need products:create`,
        );
        return;
      }
      setSelected(new Set());
      setSlideItem(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Could not ${action}`);
    } finally {
      setBusy(false);
    }
  };

  const bulkApproveHigh = async (ids: string[]) => {
    if (!ids.length) return;
    if (!defaultCategoryId) {
      setError("Pick a default category before bulk approve");
      return;
    }
    setBusy(true);
    setError(null);
    setApproveMsg(null);
    try {
      const res = await fetch("/api/admin/catalogue/discovery/bulk-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids,
          defaultCategoryId,
          highConfidenceOnly: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          (data as { error?: string }).error || "Bulk approve failed",
        );
        return;
      }
      setApproveMsg(
        `Created ${data.created || 0} · skipped ${data.skipped || 0} · failed ${data.failed || 0}`,
      );
      setSelected(new Set());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk approve failed");
    } finally {
      setBusy(false);
    }
  };

  const enqueueRelated = async (hit: RelatedHit) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/catalogue/discovery", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enqueue", candidate: hit }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          (data as { error?: string }).error ||
            "Could not add to queue — you may need products:create",
        );
        return;
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add to queue");
    } finally {
      setBusy(false);
    }
  };

  const flatItems = useMemo(
    () =>
      [...items].sort((a, b) =>
        (a.name || a.barcode || "").localeCompare(b.name || b.barcode || ""),
      ),
    [items],
  );

  useEffect(() => {
    setFocusIndex(0);
  }, [status, items]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (reviewTarget || slideItem) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (status !== "pending" || !flatItems.length) return;

      const focused = flatItems[Math.min(focusIndex, flatItems.length - 1)];
      if (!focused) return;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIndex((i) => Math.min(flatItems.length - 1, i + 1));
        return;
      }
      if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === "x" || e.key === " ") {
        e.preventDefault();
        toggleSelect(focused.publicId);
        return;
      }
      if (e.key === "e" || e.key === "Enter") {
        e.preventDefault();
        openReview({
          barcode: focused.barcode || "",
          discoveryId: focused.publicId,
          seed: focused,
        });
        return;
      }
      if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        openReview({
          barcode: focused.barcode || "",
          discoveryId: focused.publicId,
          seed: focused,
        });
        return;
      }
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        void patchOne(focused.publicId, "dismiss");
        return;
      }
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        setFocusIndex((i) => Math.min(flatItems.length - 1, i + 1));
        return;
      }
      if (e.key === "d" || e.key === "D") {
        e.preventDefault();
        if (focused.barcode) {
          window.open(
            `/admin/products/merge?q=${encodeURIComponent(focused.barcode)}`,
            "_blank",
          );
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyboard binds stable handlers
  }, [flatItems, focusIndex, reviewTarget, slideItem, status]);

  const allVisibleSelected =
    flatItems.length > 0 && flatItems.every((i) => selected.has(i.publicId));

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allVisibleSelected) setSelected(new Set());
    else setSelected(new Set(flatItems.map((i) => i.publicId)));
  };

  const statusChart = useMemo(
    () => [
      { key: "pending", label: "To add", value: counts.pending },
      { key: "imported", label: "Imported", value: counts.imported },
      { key: "dismissed", label: "Dismissed", value: counts.dismissed },
    ],
    [counts],
  );

  const providerChart = useMemo(
    () =>
      countByKey(items as unknown as Array<Record<string, unknown>>, (i) =>
        String(i.provider || "unknown"),
      ),
    [items],
  );

  const completenessChart = useMemo(
    () =>
      completenessBuckets(items.map((i) => i.preview?.completeness ?? null)),
    [items],
  );

  const nutriChart = useMemo(
    () => nutriscoreBuckets(items.map((i) => i.preview?.nutriscore ?? null)),
    [items],
  );

  const tabs: Array<{ id: StatusTab; label: string; count: number }> = [
    { id: "pending", label: "To add", count: counts.pending },
    { id: "imported", label: "Imported", count: counts.imported },
    { id: "dismissed", label: "Dismissed", count: counts.dismissed },
  ];

  const th =
    "whitespace-nowrap py-2 pr-3 text-left text-[10px] font-medium uppercase tracking-[0.12em] text-black/35";
  const td = "whitespace-nowrap py-1.5 pr-3 align-middle text-[12px]";

  return (
    <PageContainer>
      <AdminPageHeader
        title="Product discovery"
        description="Products found outside KlikCollect. Search previews are temporary."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={cn(adminUi.btnPrimary, "inline-flex items-center gap-2")}
              onClick={() => openProductScanner({ context: "discovery" })}
            >
              <ScanBarcode className="h-4 w-4" />
              Open scanner
            </button>
            <Link href="/admin/products" className={adminUi.btnGhost}>
              Catalogue
            </Link>
          </div>
        }
      />

      <div className="space-y-3">
        <CatalogueKpiStrip
          items={[
            {
              label: "To add",
              value: counts.pending,
              active: status === "pending",
              onClick: () => setStatus("pending"),
            },
            {
              label: "Imported",
              value: counts.imported,
              active: status === "imported",
              onClick: () => setStatus("imported"),
            },
            {
              label: "Dismissed",
              value: counts.dismissed,
              active: status === "dismissed",
              onClick: () => setStatus("dismissed"),
            },
            {
              label: "Live related",
              value: related.length,
              description: relatedLoading ? "Searching…" : undefined,
            },
          ]}
        />

        <div className="grid gap-6 border-b border-black/10 pb-6 lg:grid-cols-4">
          <StatusDonut
            title="Queue status"
            data={statusChart}
            activeKey={status}
            onSelect={(key) => setStatus(key as StatusTab)}
          />
          <DistributionBar
            title="Provider"
            data={providerChart}
            activeKey={provider || null}
            onSelect={(key) =>
              setProvider((prev) => (prev === key ? "" : key))
            }
          />
          <DistributionBar
            title="Completeness"
            data={completenessChart}
          />
          <DistributionBar
            title="Nutri-Score"
            data={nutriChart}
          />
        </div>

        <div className="flex flex-wrap gap-2 border-b border-black/10 pb-px">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setStatus(tab.id);
                setBrand("");
                setProvider("");
                setSlideItem(null);
                setReviewTarget(null);
                setSelected(new Set());
              }}
              className={cn(
                "-mb-px border-b-2 px-1 pb-2.5 text-[12px] font-medium",
                status === tab.id
                  ? "border-black text-black"
                  : "border-transparent text-black/40 hover:text-black/70",
              )}
            >
              {tab.label}
              <span className="ml-1.5 tabular-nums text-black/35">{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_8rem_8rem_10rem]">
          <div className="relative min-w-0 sm:col-span-2 lg:col-span-1">
            <Search className="pointer-events-none absolute left-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-black/35" />
            <input
              className={cn(adminUi.input, "h-10 pl-5 text-[13px]")}
              placeholder="Search…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <ThemeSelect
            value={source || "all"}
            onValueChange={(v) => setSource(v === "all" ? "" : v)}
            size="sm"
            fullWidth
            placeholder="Source"
            triggerClassName="h-10 w-full"
            options={[
              { value: "all", label: "All sources" },
              { value: "scan", label: "Scan" },
              { value: "similar", label: "Similar" },
              { value: "search", label: "Search" },
            ]}
          />
          <ThemeSelect
            value={provider || "all"}
            onValueChange={(v) => setProvider(v === "all" ? "" : v)}
            size="sm"
            fullWidth
            placeholder="Provider"
            triggerClassName="h-10 w-full"
            options={[
              { value: "all", label: "All providers" },
              ...providerChart.map((p) => ({
                value: p.key,
                label: p.label,
              })),
            ]}
          />
          <ThemeSelect
            value={brand || "all"}
            onValueChange={(v) => setBrand(v === "all" ? "" : v)}
            size="sm"
            fullWidth
            placeholder="Brand"
            triggerClassName="h-10 w-full"
            options={[
              { value: "all", label: "All brands" },
              ...brands.map((b) => ({ value: b, label: b })),
            ]}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-black/45">
          <p className="uppercase tracking-[0.12em]">
            {loading ? "Loading…" : `${total} ${status}`}
            {related.length ? ` · ${related.length} live` : ""}
            {selected.size ? ` · ${selected.size} selected` : ""}
          </p>
          {status === "pending" || status === "dismissed" ? (
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                className={adminUi.btnGhost}
                disabled={!flatItems.length || busy}
                onClick={toggleSelectAll}
              >
                {allVisibleSelected ? "Clear" : "Select all"}
              </button>
              {status === "pending" ? (
                <>
                  <ThemeSelect
                    value={defaultCategoryId || "none"}
                    onValueChange={(v) =>
                      setDefaultCategoryId(v === "none" ? "" : v)
                    }
                    size="sm"
                    placeholder="Default category"
                    triggerClassName="h-8 min-w-[160px]"
                    options={[
                      { value: "none", label: "Category for approve…" },
                      ...categories.map((c) => ({
                        value: c.id,
                        label: c.name,
                      })),
                    ]}
                  />
                  <button
                    type="button"
                    className={adminUi.btnGhost}
                    disabled={!selected.size || busy || !defaultCategoryId}
                    title="Only high-confidence candidates (completeness ≥70% + resolve band high)"
                    onClick={() => void bulkApproveHigh([...selected])}
                  >
                    Approve high-confidence
                  </button>
                  <button
                    type="button"
                    className={adminUi.btnGhost}
                    disabled={!selected.size || busy}
                    onClick={() => void patchMany([...selected], "dismiss")}
                  >
                    Dismiss selected
                  </button>
                  <button
                    type="button"
                    className={adminUi.btnGhost}
                    disabled={!flatItems.length || busy}
                    onClick={() =>
                      void patchMany(
                        flatItems.map((i) => i.publicId),
                        "dismiss",
                      )
                    }
                  >
                    Dismiss visible
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className={adminUi.btnGhost}
                    disabled={!selected.size || busy}
                    onClick={() => void patchMany([...selected], "restore")}
                  >
                    Restore selected
                  </button>
                  <button
                    type="button"
                    className={adminUi.btnGhost}
                    disabled={!flatItems.length || busy}
                    onClick={() =>
                      void patchMany(
                        flatItems.map((i) => i.publicId),
                        "restore",
                      )
                    }
                  >
                    Restore visible
                  </button>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-[12px] text-red-700">{error}</p> : null}
      {approveMsg ? (
        <p className="text-[12px] text-emerald-800">{approveMsg}</p>
      ) : null}
      {status === "pending" ? (
        <p className="text-[11px] text-black/35">
          Keys: j/k move · x select · e/a review · r reject · s skip · d merge
          tab
        </p>
      ) : null}

      {status === "pending" && q.trim().length >= 2 ? (
        <section>
          <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-black/35">
            Temporary related
          </p>
          {relatedLoading && !related.length ? (
            <p className="py-2 text-[12px] text-black/40">Searching…</p>
          ) : related.length ? (
            <ul>
              {related.map((hit) => (
                <li
                  key={`live-${hit.barcode}`}
                  className="flex items-center gap-2 border-b border-black/[0.05] py-1.5"
                >
                  {hit.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={hit.image} alt="" className="h-7 w-7 object-contain" />
                  ) : (
                    <div className="h-7 w-7 bg-black/[0.04]" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium">
                      {hit.name || hit.barcode}
                    </p>
                    <p className="truncate text-[10px] text-black/40">
                      {[hit.brand, hit.categoryHint, hit.quantity]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={adminUi.btnGhost}
                    disabled={busy}
                    onClick={() => void enqueueRelated(hit)}
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    className={cn(adminUi.btnPrimary, "px-2 py-1 text-[10px]")}
                    disabled={busy}
                    onClick={() =>
                      openReview({
                        barcode: hit.barcode,
                        related: hit,
                      })
                    }
                  >
                    Review
                  </button>
                </li>
              ))}
            </ul>
          ) : !loading ? (
            <p className="py-2 text-[12px] text-black/40">No live matches.</p>
          ) : null}
        </section>
      ) : null}

      {!loading && !flatItems.length ? (
        <EmptyState status={status} hasQuery={q.trim().length >= 2} />
      ) : (
        <div className="scrollbar-hide overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse text-left">
            <thead>
              <tr className="border-b border-black/10">
                {status === "pending" || status === "dismissed" ? (
                  <th
                    className={cn(
                      th,
                      "sticky left-0 z-[1] w-7 bg-[var(--kc-canvas,#f7f7f5)] pr-2",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </th>
                ) : (
                  <th className={cn(th, "w-7 pr-2")} />
                )}
                <th
                  className={cn(
                    th,
                    "sticky z-[1] bg-[var(--kc-canvas,#f7f7f5)]",
                    status === "pending" || status === "dismissed"
                      ? "left-7"
                      : "left-0",
                  )}
                >
                  Product
                </th>
                <th className={th}>Brand</th>
                <th className={th}>Category</th>
                <th className={th}>Qty</th>
                <th className={th}>Nutri</th>
                <th className={th}>%</th>
                <th className={th}>Provider</th>
                <th className={th}>Source</th>
                <th className={th}>Seen</th>
                <th className={th}>Barcode</th>
                <th className={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {flatItems.map((item, idx) => {
                const p = item.preview;
                const focused = status === "pending" && idx === focusIndex;
                return (
                  <tr
                    key={item.publicId}
                    className={cn(
                      "border-b border-black/[0.05] hover:bg-black/[0.012]",
                      focused && "bg-black/[0.04]",
                    )}
                    onClick={() => setFocusIndex(idx)}
                  >
                    <td
                      className={cn(
                        td,
                        "sticky left-0 z-[1] bg-[var(--kc-canvas,#f7f7f5)] pr-2",
                      )}
                    >
                      {status === "pending" || status === "dismissed" ? (
                        <input
                          type="checkbox"
                          checked={selected.has(item.publicId)}
                          onChange={() => toggleSelect(item.publicId)}
                          aria-label={`Select ${item.name || item.barcode}`}
                        />
                      ) : null}
                    </td>
                    <td
                      className={cn(
                        td,
                        "sticky z-[1] bg-[var(--kc-canvas,#f7f7f5)]",
                        status === "pending" || status === "dismissed"
                          ? "left-7"
                          : "left-0",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setSlideItem(item)}
                        className="flex max-w-[220px] items-center gap-2 text-left"
                      >
                        {p?.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.image}
                            alt=""
                            className="h-7 w-7 shrink-0 object-contain"
                          />
                        ) : (
                          <div className="h-7 w-7 shrink-0 bg-black/[0.04]" />
                        )}
                        <span className="truncate font-medium text-black">
                          {item.name || "Untitled"}
                        </span>
                      </button>
                    </td>
                    <td className={cn(td, "text-black/55")}>{item.brand || "—"}</td>
                    <td className={cn(td, "max-w-[8rem] truncate text-black/45")}>
                      {p?.categoryHint || "—"}
                    </td>
                    <td className={cn(td, "text-black/45")}>{p?.quantity || "—"}</td>
                    <td className={cn(td, "uppercase text-black/45")}>
                      {p?.nutriscore || "—"}
                    </td>
                    <td className={cn(td, "tabular-nums text-black/45")}>
                      {p?.completeness != null ? p.completeness : "—"}
                    </td>
                    <td className={cn(td, "text-black/40")}>{item.provider}</td>
                    <td className={cn(td, "uppercase tracking-[0.08em] text-black/35")}>
                      {item.source}
                    </td>
                    <td className={cn(td, "text-black/35")}>
                      {relativeTime(item.lastSeenAt)}
                    </td>
                    <td className={cn(td, "font-mono text-[11px] text-black/40")}>
                      {item.barcode || "—"}
                    </td>
                    <td className={td}>
                      <div className="flex flex-wrap items-center gap-0.5">
                        <button
                          type="button"
                          className={adminUi.btnGhost}
                          onClick={() => setSlideItem(item)}
                        >
                          Open
                        </button>
                        {status === "pending" ? (
                          <>
                            <button
                              type="button"
                              className={cn(
                                adminUi.btnPrimary,
                                "px-2 py-1 text-[10px]",
                              )}
                              disabled={!item.barcode || busy}
                              onClick={() => {
                                if (!item.barcode) return;
                                openReview({
                                  barcode: item.barcode,
                                  discoveryId: item.publicId,
                                  seed: item,
                                });
                              }}
                            >
                              Review
                            </button>
                            <button
                              type="button"
                              className={adminUi.btnGhost}
                              disabled={busy}
                              onClick={() =>
                                void patchOne(item.publicId, "dismiss")
                              }
                            >
                              Dismiss
                            </button>
                          </>
                        ) : null}
                        {status === "dismissed" ? (
                          <button
                            type="button"
                            className={adminUi.btnGhost}
                            disabled={busy}
                            onClick={() =>
                              void patchOne(item.publicId, "restore")
                            }
                          >
                            Restore
                          </button>
                        ) : null}
                        {status === "imported" &&
                        item.resolvedProductPublicId ? (
                          <Link
                            href={`/admin/products/${item.resolvedProductPublicId}`}
                            className={adminUi.btnGhost}
                          >
                            Open
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {slideItem ? (
        <SlideOver
          open
          onClose={() => setSlideItem(null)}
          title="Discovery"
          subtitle={slideItem.name || slideItem.barcode || "Untitled"}
          wide
          footer={
            <div className="flex flex-wrap gap-2">
              {status === "pending" ? (
                <>
                  <button
                    type="button"
                    className={adminUi.btnPrimary}
                    disabled={!slideItem.barcode || busy}
                    onClick={() => {
                      if (!slideItem.barcode) return;
                      openReview({
                        barcode: slideItem.barcode,
                        discoveryId: slideItem.publicId,
                        seed: slideItem,
                      });
                    }}
                  >
                    Review
                  </button>
                  <button
                    type="button"
                    className={adminUi.btnGhost}
                    disabled={busy}
                    onClick={() => void patchOne(slideItem.publicId, "dismiss")}
                  >
                    Dismiss
                  </button>
                </>
              ) : null}
              {status === "dismissed" ? (
                <button
                  type="button"
                  className={adminUi.btnSecondary}
                  disabled={busy}
                  onClick={() => void patchOne(slideItem.publicId, "restore")}
                >
                  Restore
                </button>
              ) : null}
              {status === "imported" && slideItem.resolvedProductPublicId ? (
                <Link
                  href={`/admin/products/${slideItem.resolvedProductPublicId}`}
                  className={adminUi.btnPrimary}
                  onClick={() => setSlideItem(null)}
                >
                  Open product
                </Link>
              ) : null}
            </div>
          }
        >
          <ProductDataVisual
            data={{
              name: slideItem.name,
              brand: slideItem.brand,
              barcode: slideItem.barcode,
              image: slideItem.preview?.image,
              quantity: slideItem.preview?.quantity,
              statusLabel: `${slideItem.status} · ${slideItem.source}`,
              categoryName: slideItem.preview?.categoryHint,
              candidate: slideItem.payload as Partial<CandidateProduct>,
              extraMeta: [
                { label: "Provider", value: slideItem.provider },
                { label: "Source", value: slideItem.source },
                ...(slideItem.externalProductId
                  ? [
                      {
                        label: "External ID",
                        value: slideItem.externalProductId,
                      },
                    ]
                  : []),
                ...(slideItem.similaritySeedBarcode
                  ? [
                      {
                        label: "Seed barcode",
                        value: slideItem.similaritySeedBarcode,
                      },
                    ]
                  : []),
                ...(slideItem.preview?.completeness != null
                  ? [
                      {
                        label: "Completeness",
                        value: `${slideItem.preview.completeness}%`,
                      },
                    ]
                  : []),
                {
                  label: "Last seen",
                  value: new Date(slideItem.lastSeenAt).toLocaleString(),
                },
                {
                  label: "Queued",
                  value: new Date(slideItem.createdAt).toLocaleString(),
                },
                ...(slideItem.resolvedProductPublicId
                  ? [
                      {
                        label: "Product ID",
                        value: slideItem.resolvedProductPublicId,
                      },
                    ]
                  : []),
              ],
            }}
          />
        </SlideOver>
      ) : null}

      {reviewTarget ? (
        <SlideOver
          open
          onClose={() => setReviewTarget(null)}
          title="Review"
          subtitle={
            reviewTarget.seed?.name ||
            reviewTarget.related?.name ||
            reviewTarget.barcode
          }
          dashboard
        >
          <DiscoveryReviewPanel
            barcode={reviewTarget.barcode}
            discoveryId={reviewTarget.discoveryId}
            seed={
              reviewTarget.seed ||
              (reviewTarget.related
                ? {
                    name: reviewTarget.related.name,
                    brand: reviewTarget.related.brand,
                    barcode: reviewTarget.related.barcode,
                    preview: {
                      image: reviewTarget.related.image,
                      quantity: reviewTarget.related.quantity || null,
                      nutriscore: reviewTarget.related.nutriscore || null,
                      ingredientsPreview: null,
                      categoryHint: reviewTarget.related.categoryHint || null,
                      completeness: 0,
                    },
                    payload: {},
                    status: "pending",
                    source: "search",
                    provider: reviewTarget.related.provider,
                  }
                : null)
            }
            onClose={() => setReviewTarget(null)}
            onDismiss={
              reviewTarget.discoveryId
                ? () => {
                    const id = reviewTarget.discoveryId!;
                    setReviewTarget(null);
                    void patchOne(id, "dismiss");
                  }
                : undefined
            }
            onCreated={() => {
              setReviewTarget(null);
              void load();
            }}
          />
        </SlideOver>
      ) : null}
    </PageContainer>
  );
}

function EmptyState({
  status,
  hasQuery,
}: {
  status: StatusTab;
  hasQuery?: boolean;
}) {
  const copy =
    status === "pending"
      ? hasQuery
        ? {
            title: "No queue matches",
            body: "Live related results appear above when available.",
          }
        : {
            title: "Nothing waiting",
            body: "Search to preview related products, or open the scanner.",
          }
      : status === "imported"
        ? {
            title: "No imports yet",
            body: "Products you create from discovery show up here.",
          }
        : {
            title: "No dismissed items",
            body: "Dismissed discoveries can be restored anytime.",
          };

  return (
    <div className="border-y border-black/[0.06] py-14 text-center">
      <PackagePlus className="mx-auto h-6 w-6 text-black/25" />
      <h2 className="mt-3 text-[16px] font-medium text-black">{copy.title}</h2>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] text-black/45">
        {copy.body}
      </p>
    </div>
  );
}
