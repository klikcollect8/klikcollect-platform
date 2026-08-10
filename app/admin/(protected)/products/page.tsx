"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  Copy,
  Plus,
  ScanBarcode,
} from "lucide-react";
import AccessControl from "@/components/admin/AccessControl";
import PageContainer, {
  AdminPageHeader,
} from "@/components/admin/PageContainer";
import ProductCreateWizard from "@/components/admin/catalogue/ProductCreateWizard";
import CatalogueBarcodeScanner from "@/components/admin/catalogue/CatalogueBarcodeScanner";
import CatalogueSearchBar from "@/components/admin/catalogue/CatalogueSearchBar";
import { adminUi } from "@/components/admin/admin-ui";
import { useToast } from "@/components/ToastProvider";
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
  const [dense, setDense] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(
    searchParams.get("create") === "1",
  );
  const [editId, setEditId] = useState<string | null>(
    searchParams.get("edit"),
  );
  const [scanOpen, setScanOpen] = useState(false);
  const [scanCode, setScanCode] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
              className={adminUi.btnSecondary}
              onClick={() => setScanOpen(true)}
            >
              <ScanBarcode className="h-4 w-4" />
              Scan barcode
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
          <div className="scrollbar-hide max-h-[50vh] overflow-y-auto border border-black/10 bg-white/40 p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-black/40">
                Advanced filters
              </p>
              {activeFilterCount > 0 ? (
                <button
                  type="button"
                  onClick={clearAdvanced}
                  className="text-[12px] text-black/50 underline decoration-black/20 underline-offset-4 hover:text-black"
                >
                  Clear
                </button>
              ) : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block text-[12px] text-black/50">
                Product type
                <select
                  className={cn(adminUi.input, "mt-1")}
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                >
                  <option value="">All types</option>
                  {PRODUCT_KINDS.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[12px] text-black/50">
                Category
                <select
                  className={cn(adminUi.input, "mt-1")}
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">All categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[12px] text-black/50">
                Brand
                <select
                  className={cn(adminUi.input, "mt-1")}
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                >
                  <option value="">All brands</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[12px] text-black/50">
                Guide min (KES)
                <input
                  className={cn(adminUi.input, "mt-1")}
                  inputMode="numeric"
                  value={guideMin}
                  onChange={(e) => setGuideMin(e.target.value)}
                  placeholder="0"
                />
              </label>
              <label className="block text-[12px] text-black/50">
                Guide max (KES)
                <input
                  className={cn(adminUi.input, "mt-1")}
                  inputMode="numeric"
                  value={guideMax}
                  onChange={(e) => setGuideMax(e.target.value)}
                  placeholder="Any"
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-[12px] text-black/55">
              {(
                [
                  ["Missing images", missingImage, setMissingImage],
                  ["Missing barcode", missingBarcode, setMissingBarcode],
                  ["Missing SEO", missingSeo, setMissingSeo],
                  ["Has variants", hasVariants, setHasVariants],
                  ["No vendor offers", noOffers, setNoOffers],
                  ["Has vendor offers", hasOffers, setHasOffers],
                  ["Featured only", featuredOnly, setFeaturedOnly],
                ] as const
              ).map(([label, checked, set]) => (
                <label key={label} className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => set(e.target.checked)}
                  />
                  {label}
                </label>
              ))}
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
              className={adminUi.btnGhost}
              onClick={() => setDense((d) => !d)}
            >
              {dense ? "Comfortable" : "Dense"}
            </button>
          </div>
        </div>
      </div>

      <div className="scrollbar-hide overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-black/10 text-[11px] uppercase tracking-[0.14em] text-black/40">
              <th className={cn("py-3 pr-2", dense ? "py-2" : "")}>
                <input
                  type="checkbox"
                  checked={items.length > 0 && selected.size === items.length}
                  onChange={toggleAll}
                  aria-label="Select all"
                />
              </th>
              <th className="py-3 pr-4 font-medium">Product</th>
              <th className="py-3 pr-4 font-medium">SKU</th>
              <th className="py-3 pr-4 font-medium">Type</th>
              <th className="py-3 pr-4 font-medium">Guide</th>
              <th className="py-3 pr-4 font-medium">Offers</th>
              <th className="py-3 pr-4 font-medium">Status</th>
              <th className="py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr
                key={row.id}
                className="border-b border-black/[0.06] hover:bg-black/[0.015]"
              >
                <td className={cn("py-3 pr-2 align-middle", dense && "py-2")}>
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => toggleSelect(row.id)}
                    aria-label={`Select ${row.name}`}
                  />
                </td>
                <td className={cn("py-3 pr-4 align-middle", dense && "py-2")}>
                  <Link
                    href={`/admin/products/${row.id}`}
                    className="flex items-center gap-3"
                  >
                    <span className="relative h-10 w-10 shrink-0 overflow-hidden bg-black/[0.04]">
                      {row.image ? (
                        <Image
                          src={row.image}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      ) : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-black">
                        {row.name}
                      </span>
                      <span className="block truncate text-[11px] text-black/35">
                        {row.barcode || "No barcode"}
                        {row.featured ? " · Featured" : ""}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className={cn("py-3 pr-4 align-middle tabular-nums text-black/60", dense && "py-2")}>
                  {row.sku || "—"}
                </td>
                <td className={cn("py-3 pr-4 align-middle text-black/55", dense && "py-2")}>
                  {kindLabel(row.productKind)}
                </td>
                <td className={cn("py-3 pr-4 align-middle tabular-nums", dense && "py-2")}>
                  <span className="block text-black">
                    {formatKesMinor(row.guidePriceAvgMinor)}
                  </span>
                  <span className="block text-[11px] text-black/35">
                    {formatKesMinor(row.guidePriceMinMinor)} –{" "}
                    {formatKesMinor(row.guidePriceMaxMinor)}
                  </span>
                </td>
                <td className={cn("py-3 pr-4 align-middle tabular-nums text-black/55", dense && "py-2")}>
                  {row.offerCount ?? 0}
                </td>
                <td className={cn("py-3 pr-4 align-middle", dense && "py-2")}>
                  <span className="text-[11px] uppercase tracking-[0.12em] text-black/45">
                    {String(row.status || "").replace("_", " ")}
                  </span>
                </td>
                <td className={cn("py-3 align-middle", dense && "py-2")}>
                  <div className="flex flex-wrap gap-1">
                    <Link
                      href={`/admin/products/${row.id}`}
                      className={adminUi.btnGhost}
                    >
                      View
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

      <CatalogueBarcodeScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onDetected={(code) => {
          setScanCode(code);
          void (async () => {
            const res = await fetch(
              `/api/admin/catalogue/barcode/${encodeURIComponent(code)}`,
            );
            const data = await res.json();
            if (data.found && data.product) {
              router.push(`/admin/products/${data.product.id}`);
              return;
            }
            setEditId(null);
            setWizardOpen(true);
            showToast("No existing product — create from barcode", "info");
          })();
        }}
      />

      <ProductCreateWizard
        open={wizardOpen}
        initialProductId={editId}
        initialBarcode={scanCode || null}
        onClose={() => {
          setWizardOpen(false);
          setEditId(null);
          setScanCode("");
          setPage(1);
          void load();
        }}
      />
    </PageContainer>
  );
}
