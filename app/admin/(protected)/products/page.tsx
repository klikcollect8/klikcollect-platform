"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  Copy,
  ImageIcon,
  Plus,
  ScanBarcode,
} from "lucide-react";
import AccessControl from "@/components/admin/AccessControl";
import PageContainer, {
  AdminPageHeader,
} from "@/components/admin/PageContainer";
import SlideOver from "@/components/admin/SlideOver";
import ProductDataVisual from "@/components/admin/catalogue/ProductDataVisual";
import ProductCreateWizard from "@/components/admin/catalogue/ProductCreateWizard";
import CatalogueSearchBar from "@/components/admin/catalogue/CatalogueSearchBar";
import ThemeSelect from "@/components/ui/ThemeSelect";
import { adminUi } from "@/components/admin/admin-ui";
import { useToast } from "@/components/ToastProvider";
import { openProductScanner } from "@/lib/admin/product-scanner-events";
import { PRODUCT_KINDS } from "@/lib/catalogue/product-draft";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  image?: string;
  status: string;
  productKind?: string;
  offerCount?: number;
  minPriceMinor?: number | null;
  guidePriceAvgMinor?: number | null;
  guidePriceMinMinor?: number | null;
  guidePriceMaxMinor?: number | null;
  totalStock?: number;
  updatedAt?: string;
  featured?: boolean;
};

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "pending_review", label: "Pending review" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

const SORT_OPTIONS = [
  { value: "updated_desc", label: "Newest updated" },
  { value: "updated_asc", label: "Oldest updated" },
  { value: "name_asc", label: "Name A–Z" },
  { value: "name_desc", label: "Name Z–A" },
  { value: "guide_asc", label: "Guide price ↑" },
];

const PAGE_SIZE = 48;

function formatKesMinor(minor?: number | null) {
  if (minor == null || !Number.isFinite(Number(minor))) return "—";
  return `KSh ${Math.round(Number(minor) / 100).toLocaleString()}`;
}

function kindLabel(kind?: string) {
  return PRODUCT_KINDS.find((k) => k.id === kind)?.label || kind || "—";
}

export default function AdminProductsPage() {
  return (
    <AccessControl requiredPermission="products:view">
      <ProductsCatalogue />
    </AccessControl>
  );
}

function ProductsCatalogue() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const searchRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("updated_desc");
  const [kind, setKind] = useState("");
  const [missingImage, setMissingImage] = useState(false);
  const [missingBarcode, setMissingBarcode] = useState(false);
  const [missingSeo, setMissingSeo] = useState(false);
  const [hasVariants, setHasVariants] = useState(false);
  const [noOffers, setNoOffers] = useState(false);
  const [hasOffers, setHasOffers] = useState(false);
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [guideMin, setGuideMin] = useState("");
  const [guideMax, setGuideMax] = useState("");
  const [categories, setCategories] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [brands, setBrands] = useState<Array<{ id: string; name: string }>>([]);
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [showImages, setShowImages] = useState(true);
  const [slideRow, setSlideRow] = useState<Row | null>(null);
  const [slideDetail, setSlideDetail] = useState<{
    brand?: string | null;
    categoryName?: string | null;
    description?: string | null;
    saleUnit?: string | null;
    attributes?: Record<string, string> | null;
    image?: string | null;
    barcode?: string | null;
    sku?: string | null;
    gtin?: string | null;
  } | null>(null);
  const [slideLoading, setSlideLoading] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(
    searchParams.get("create") === "1",
  );
  const [editId, setEditId] = useState<string | null>(
    searchParams.get("edit"),
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if ((e.key === "s" || e.key === "S") && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        openProductScanner({ context: "catalogue" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!slideRow) {
      setSlideDetail(null);
      setSlideLoading(false);
      return;
    }
    let cancelled = false;
    setSlideLoading(true);
    setSlideDetail(null);
    void (async () => {
      try {
        const res = await fetch(
          `/api/admin/catalogue/products/${encodeURIComponent(slideRow.id)}`,
        );
        const data = await res.json();
        if (cancelled || !res.ok) return;
        const p = data.product as {
          brandName?: string | null;
          categoryName?: string | null;
          description?: string | null;
          saleUnit?: string | null;
          attributes?: Record<string, string> | null;
          image?: string | null;
          barcode?: string | null;
          sku?: string | null;
          gtin?: string | null;
          media?: Array<{ url?: string; role?: string }>;
        };
        const primaryMedia =
          p.media?.find((m) => m.role === "primary")?.url ||
          p.media?.[0]?.url ||
          null;
        setSlideDetail({
          brand: p.brandName || null,
          categoryName: p.categoryName || null,
          description: p.description || null,
          saleUnit: p.saleUnit || null,
          attributes: p.attributes || null,
          image: primaryMedia || p.image || null,
          barcode: p.barcode || null,
          sku: p.sku || null,
          gtin: p.gtin || null,
        });
      } catch {
        /* keep list fields */
      } finally {
        if (!cancelled) setSlideLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slideRow]);

  useEffect(() => {
    void (async () => {
      try {
        const [cRes, bRes] = await Promise.all([
          fetch("/api/admin/catalogue/meta?kind=categories"),
          fetch("/api/admin/catalogue/meta?kind=brands"),
        ]);
        const cData = await cRes.json();
        const bData = await bRes.json();
        setCategories(
          (cData.categories || []).map(
            (c: { id?: string; public_id?: string; name: string }) => ({
              id: c.public_id || c.id || "",
              name: c.name,
            }),
          ),
        );
        setBrands(
          (bData.brands || []).map(
            (b: { public_id?: string; id?: string; name: string }) => ({
              id: b.public_id || b.id || "",
              name: b.name,
            }),
          ),
        );
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (kind) n += 1;
    if (categoryId) n += 1;
    if (brandId) n += 1;
    if (missingImage) n += 1;
    if (missingBarcode) n += 1;
    if (missingSeo) n += 1;
    if (hasVariants) n += 1;
    if (noOffers) n += 1;
    if (hasOffers) n += 1;
    if (featuredOnly) n += 1;
    if (guideMin.trim()) n += 1;
    if (guideMax.trim()) n += 1;
    return n;
  }, [
    kind,
    categoryId,
    brandId,
    missingImage,
    missingBarcode,
    missingSeo,
    hasVariants,
    noOffers,
    hasOffers,
    featuredOnly,
    guideMin,
    guideMax,
  ]);

  const clearAdvanced = () => {
    setKind("");
    setCategoryId("");
    setBrandId("");
    setMissingImage(false);
    setMissingBarcode(false);
    setMissingSeo(false);
    setHasVariants(false);
    setNoOffers(false);
    setHasOffers(false);
    setFeaturedOnly(false);
    setGuideMin("");
    setGuideMax("");
    setPage(1);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        sort,
      });
      if (debouncedQ.trim()) params.set("q", debouncedQ.trim());
      if (status) params.set("status", status);
      if (kind) params.set("kind", kind);
      if (categoryId) params.set("categoryId", categoryId);
      if (brandId) params.set("brandId", brandId);
      if (missingImage) params.set("missingImage", "1");
      if (missingBarcode) params.set("missingBarcode", "1");
      if (missingSeo) params.set("missingSeo", "1");
      if (hasVariants) params.set("hasVariants", "1");
      if (noOffers) params.set("noOffers", "1");
      if (hasOffers) params.set("hasOffers", "1");
      if (featuredOnly) params.set("featured", "1");
      if (guideMin.trim()) params.set("guideMin", guideMin.trim());
      if (guideMax.trim()) params.set("guideMax", guideMax.trim());
      const res = await fetch(`/api/admin/catalogue/products?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      const next = (data.items || []) as Row[];
      setItems((prev) => (page === 1 ? next : [...prev, ...next]));
      setTotal(data.total || 0);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to load", "error");
    } finally {
      setLoading(false);
    }
  }, [
    page,
    debouncedQ,
    status,
    sort,
    kind,
    categoryId,
    brandId,
    missingImage,
    missingBarcode,
    missingSeo,
    hasVariants,
    noOffers,
    hasOffers,
    featuredOnly,
    guideMin,
    guideMax,
    showToast,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
    setItems([]);
  }, [
    debouncedQ,
    status,
    sort,
    kind,
    categoryId,
    brandId,
    missingImage,
    missingBarcode,
    missingSeo,
    hasVariants,
    noOffers,
    hasOffers,
    featuredOnly,
    guideMin,
    guideMax,
  ]);

  const hasMore = items.length < total;

  const duplicate = async (id: string) => {
    const res = await fetch(`/api/admin/catalogue/products/${id}/duplicate`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "Duplicate failed", "error");
      return;
    }
    showToast("Product duplicated as draft", "success");
    setEditId(data.product.id);
    setWizardOpen(true);
    setPage(1);
    void load();
  };

  const archive = async (id: string) => {
    if (!confirm("Archive this product? It will leave storefront discovery."))
      return;
    const res = await fetch(`/api/admin/catalogue/products/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "admin_archive" }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "Archive failed", "error");
      return;
    }
    showToast("Product archived", "success");
    setPage(1);
    void load();
  };

  const bulkArchive = async () => {
    if (!selected.size) return;
    if (
      !confirm(
        `Archive ${selected.size} product(s)? They will leave storefront discovery.`,
      )
    )
      return;
    for (const id of selected) {
      await fetch(`/api/admin/catalogue/products/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "admin_bulk_archive" }),
      });
    }
    setSelected(new Set());
    showToast("Selected products archived", "success");
    setPage(1);
    void load();
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.id)));
  };

  return (
    <PageContainer className="scrollbar-hide">
      <AdminPageHeader
        title="Catalogue"
        description="Every platform product. Vendors set their own price and stock on offers."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={cn(adminUi.btnSecondary, "inline-flex items-center gap-2")}
              onClick={() => openProductScanner({ context: "catalogue" })}
            >
              <ScanBarcode className="h-4 w-4" />
              Scan product
            </button>
            <button
              type="button"
              className={adminUi.btnPrimary}
              onClick={() => {
                setEditId(null);
                setWizardOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Create product
            </button>
          </div>
        }
      />

      <div className="sticky top-0 z-20 -mx-1 space-y-3 bg-[#f7f7f5]/95 px-1 py-3 backdrop-blur-md">
        <CatalogueSearchBar
          ref={searchRef}
          query={q}
          onQueryChange={(v) => {
            setQ(v);
          }}
          status={status}
          onStatusChange={setStatus}
          sort={sort}
          onSortChange={setSort}
          advancedOpen={advancedOpen}
          onToggleAdvanced={() => setAdvancedOpen((o) => !o)}
          activeFilterCount={activeFilterCount}
          statusOptions={STATUS_OPTIONS}
          sortOptions={SORT_OPTIONS}
        />

        {advancedOpen ? (
          <div className="space-y-4 border-y border-black/[0.06] py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-black/35">
                Filters
              </p>
              {activeFilterCount > 0 ? (
                <button
                  type="button"
                  onClick={clearAdvanced}
                  className="text-[12px] text-black/45 underline decoration-black/15 underline-offset-4 hover:text-black"
                >
                  Clear
                </button>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <ThemeSelect
                value={kind || "all"}
                onValueChange={(v) => setKind(v === "all" ? "" : v)}
                size="sm"
                fullWidth
                placeholder="Product type"
                triggerClassName="h-10 w-full"
                options={[
                  { value: "all", label: "All types" },
                  ...PRODUCT_KINDS.map((k) => ({
                    value: k.id,
                    label: k.label,
                  })),
                ]}
              />
              <ThemeSelect
                value={categoryId || "all"}
                onValueChange={(v) => setCategoryId(v === "all" ? "" : v)}
                size="sm"
                fullWidth
                placeholder="Category"
                triggerClassName="h-10 w-full"
                options={[
                  { value: "all", label: "All categories" },
                  ...categories.map((c) => ({
                    value: c.id,
                    label: c.name,
                  })),
                ]}
              />
              <ThemeSelect
                value={brandId || "all"}
                onValueChange={(v) => setBrandId(v === "all" ? "" : v)}
                size="sm"
                fullWidth
                placeholder="Brand"
                triggerClassName="h-10 w-full"
                options={[
                  { value: "all", label: "All brands" },
                  ...brands.map((b) => ({ value: b.id, label: b.name })),
                ]}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <input
                className={cn(adminUi.input, "h-10")}
                inputMode="numeric"
                value={guideMin}
                onChange={(e) => setGuideMin(e.target.value)}
                placeholder="Guide min (KES)"
                aria-label="Guide min"
              />
              <input
                className={cn(adminUi.input, "h-10")}
                inputMode="numeric"
                value={guideMax}
                onChange={(e) => setGuideMax(e.target.value)}
                placeholder="Guide max (KES)"
                aria-label="Guide max"
              />
              <div className="flex flex-wrap gap-1.5 sm:justify-end">
                {(
                  [
                    ["No image", missingImage, setMissingImage],
                    ["No barcode", missingBarcode, setMissingBarcode],
                    ["No SEO", missingSeo, setMissingSeo],
                    ["Variants", hasVariants, setHasVariants],
                    ["No offers", noOffers, setNoOffers],
                    ["Has offers", hasOffers, setHasOffers],
                    ["Featured", featuredOnly, setFeaturedOnly],
                  ] as const
                ).map(([label, checked, set]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => set(!checked)}
                    aria-pressed={checked}
                    className={cn(
                      "px-2.5 py-1.5 text-[11px] transition-colors",
                      checked
                        ? "bg-black text-white"
                        : "text-black/45 hover:text-black",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 text-[12px] text-black/45">
          <p>
            {total.toLocaleString()} product{total === 1 ? "" : "s"}
            {loading ? " · Loading…" : ""}
            {selected.size ? ` · ${selected.size} selected` : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            {selected.size > 0 ? (
              <button
                type="button"
                className={adminUi.btnGhost}
                onClick={() => void bulkArchive()}
              >
                Archive selected
              </button>
            ) : null}
            <button
              type="button"
              className={cn(
                adminUi.btnGhost,
                "inline-flex items-center gap-1.5",
                showImages && "text-black",
              )}
              onClick={() => setShowImages((v) => !v)}
              aria-pressed={showImages}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              {showImages ? "Hide images" : "Show images"}
            </button>
          </div>
        </div>
      </div>

      <div className="scrollbar-hide overflow-x-auto">
        <table className="w-full min-w-[1200px] border-collapse text-left text-[12px]">
          <thead>
            <tr className="border-b border-black/10 text-[10px] uppercase tracking-[0.12em] text-black/35">
              <th className="sticky left-0 z-[1] bg-[var(--kc-canvas,#f7f7f5)] py-2 pr-2">
                <input
                  type="checkbox"
                  checked={items.length > 0 && selected.size === items.length}
                  onChange={toggleAll}
                  aria-label="Select all"
                />
              </th>
              <th className="sticky left-7 z-[1] bg-[var(--kc-canvas,#f7f7f5)] py-2 pr-3 font-medium">
                Product
              </th>
              <th className="whitespace-nowrap py-2 pr-3 font-medium">SKU</th>
              <th className="whitespace-nowrap py-2 pr-3 font-medium">Barcode</th>
              <th className="whitespace-nowrap py-2 pr-3 font-medium">Type</th>
              <th className="whitespace-nowrap py-2 pr-3 font-medium">Guide</th>
              <th className="whitespace-nowrap py-2 pr-3 font-medium">Min offer</th>
              <th className="whitespace-nowrap py-2 pr-3 font-medium">Offers</th>
              <th className="whitespace-nowrap py-2 pr-3 font-medium">Stock</th>
              <th className="whitespace-nowrap py-2 pr-3 font-medium">Status</th>
              <th className="whitespace-nowrap py-2 pr-3 font-medium">Updated</th>
              <th className="whitespace-nowrap py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr
                key={row.id}
                className="border-b border-black/[0.05] hover:bg-black/[0.012]"
              >
                <td className="sticky left-0 z-[1] bg-[var(--kc-canvas,#f7f7f5)] py-1.5 pr-2 align-middle">
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => toggleSelect(row.id)}
                    aria-label={`Select ${row.name}`}
                  />
                </td>
                <td className="sticky left-7 z-[1] bg-[var(--kc-canvas,#f7f7f5)] py-1.5 pr-3 align-middle">
                  <button
                    type="button"
                    onClick={() => setSlideRow(row)}
                    className="flex max-w-[220px] items-center gap-2 text-left"
                  >
                    {showImages ? (
                      <span className="relative h-7 w-7 shrink-0 overflow-hidden bg-black/[0.04]">
                        {row.image ? (
                          <Image
                            src={row.image}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="28px"
                          />
                        ) : null}
                      </span>
                    ) : null}
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-black">
                        {row.name}
                      </span>
                      {row.featured ? (
                        <span className="text-[10px] text-black/35">Featured</span>
                      ) : null}
                    </span>
                  </button>
                </td>
                <td className="whitespace-nowrap py-1.5 pr-3 align-middle tabular-nums text-black/55">
                  {row.sku || "—"}
                </td>
                <td className="whitespace-nowrap py-1.5 pr-3 align-middle font-mono text-[11px] text-black/40">
                  {row.barcode || "—"}
                </td>
                <td className="whitespace-nowrap py-1.5 pr-3 align-middle text-black/50">
                  {kindLabel(row.productKind)}
                </td>
                <td className="whitespace-nowrap py-1.5 pr-3 align-middle tabular-nums">
                  {formatKesMinor(row.guidePriceAvgMinor)}
                </td>
                <td className="whitespace-nowrap py-1.5 pr-3 align-middle tabular-nums text-black/50">
                  {formatKesMinor(row.minPriceMinor)}
                </td>
                <td className="whitespace-nowrap py-1.5 pr-3 align-middle tabular-nums text-black/50">
                  {row.offerCount ?? 0}
                </td>
                <td className="whitespace-nowrap py-1.5 pr-3 align-middle tabular-nums text-black/50">
                  {row.totalStock ?? "—"}
                </td>
                <td className="whitespace-nowrap py-1.5 pr-3 align-middle">
                  <span className="text-[10px] uppercase tracking-[0.1em] text-black/40">
                    {String(row.status || "").replace("_", " ")}
                  </span>
                </td>
                <td className="whitespace-nowrap py-1.5 pr-3 align-middle text-[11px] text-black/35">
                  {row.updatedAt
                    ? new Date(row.updatedAt).toLocaleDateString()
                    : "—"}
                </td>
                <td className="whitespace-nowrap py-1.5 align-middle">
                  <div className="flex flex-wrap items-center gap-0.5">
                    <button
                      type="button"
                      className={adminUi.btnGhost}
                      onClick={() => setSlideRow(row)}
                    >
                      Open
                    </button>
                    <Link
                      href={`/admin/products/${row.id}`}
                      className={adminUi.btnGhost}
                    >
                      Page
                    </Link>
                    <button
                      type="button"
                      className={adminUi.btnGhost}
                      onClick={() => {
                        setEditId(row.id);
                        setWizardOpen(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className={adminUi.btnGhost}
                      onClick={() => void duplicate(row.id)}
                      aria-label="Duplicate"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className={adminUi.btnGhost}
                      onClick={() => void archive(row.id)}
                      aria-label="Archive"
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && items.length === 0 ? (
          <div className="border-b border-black/10 py-16 text-center">
            <p className="text-[15px] text-black/50">No products match.</p>
            <button
              type="button"
              className={cn(adminUi.btnPrimary, "mt-6")}
              onClick={() => {
                setEditId(null);
                setWizardOpen(true);
              }}
            >
              Create product
            </button>
          </div>
        ) : null}
      </div>

      {hasMore ? (
        <div className="mt-10 text-center">
          <button
            type="button"
            className={adminUi.btnPrimary}
            disabled={loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Load more
          </button>
        </div>
      ) : null}

      {slideRow ? (
        <SlideOver
          open
          onClose={() => setSlideRow(null)}
          title="Catalogue"
          subtitle={slideRow.name}
          wide
          footer={
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/admin/products/${slideRow.id}`}
                className={adminUi.btnPrimary}
                onClick={() => setSlideRow(null)}
              >
                Open page
              </Link>
              <button
                type="button"
                className={adminUi.btnSecondary}
                onClick={() => {
                  setEditId(slideRow.id);
                  setWizardOpen(true);
                  setSlideRow(null);
                }}
              >
                Edit
              </button>
              {slideRow.barcode ? (
                <button
                  type="button"
                  className={adminUi.btnGhost}
                  onClick={() => {
                    openProductScanner({
                      context: "catalogue",
                      barcode: slideRow.barcode,
                    });
                  }}
                >
                  Rescan
                </button>
              ) : null}
              <button
                type="button"
                className={adminUi.btnGhost}
                onClick={() => {
                  void duplicate(slideRow.id);
                  setSlideRow(null);
                }}
              >
                Duplicate
              </button>
            </div>
          }
        >
          {slideLoading ? (
            <p className="text-[12px] text-black/40">Loading detail…</p>
          ) : null}
          <ProductDataVisual
            data={{
              name: slideRow.name,
              brand: slideDetail?.brand,
              barcode: slideDetail?.barcode || slideRow.barcode,
              image: slideDetail?.image || slideRow.image,
              description: slideDetail?.description,
              statusLabel: String(slideRow.status || "").replace("_", " "),
              sku: slideDetail?.sku || slideRow.sku,
              productKind: kindLabel(slideRow.productKind),
              saleUnit: slideDetail?.saleUnit,
              guidePrice: formatKesMinor(slideRow.guidePriceAvgMinor),
              minOffer: formatKesMinor(slideRow.minPriceMinor),
              offerCount: slideRow.offerCount,
              totalStock: slideRow.totalStock,
              updatedAt: slideRow.updatedAt,
              productStatus: slideRow.status,
              categoryName: slideDetail?.categoryName,
              attributes: slideDetail?.attributes,
              extraMeta: [
                ...(slideDetail?.gtin
                  ? [{ label: "GTIN", value: slideDetail.gtin }]
                  : []),
                ...(slideRow.featured
                  ? [{ label: "Featured", value: "Yes" }]
                  : []),
              ],
              localProduct: {
                id: slideRow.id,
                name: slideRow.name,
                sku: slideDetail?.sku || slideRow.sku || null,
                barcode: slideDetail?.barcode || slideRow.barcode || null,
                gtin: slideDetail?.gtin || null,
                status: slideRow.status,
                image: slideDetail?.image || slideRow.image || null,
                brand: slideDetail?.brand || null,
                categoryId: null,
                categoryName: slideDetail?.categoryName || null,
                updatedAt: slideRow.updatedAt || null,
              },
            }}
          />
        </SlideOver>
      ) : null}

      <ProductCreateWizard
        open={wizardOpen}
        initialProductId={editId}
        onClose={() => {
          setWizardOpen(false);
          setEditId(null);
          setPage(1);
          void load();
        }}
      />
    </PageContainer>
  );
}
