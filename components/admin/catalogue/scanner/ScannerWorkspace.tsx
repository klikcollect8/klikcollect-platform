"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { History, ScanBarcode, Search, X } from "lucide-react";
import ProductIntelligenceSheet from "@/components/admin/catalogue/resolver/ProductIntelligenceSheet";
import ProductVisualBoard from "@/components/admin/catalogue/scanner/ProductVisualBoard";
import { adminUi } from "@/components/admin/admin-ui";
import type { ProductScannerContext } from "@/lib/admin/product-scanner-events";
import type {
  ResolveResult,
  SimilarProductHit,
} from "@/lib/product-resolver/types";
import { cn } from "@/lib/utils";

const BarcodeScannerPanel = dynamic(
  () => import("@/components/admin/catalogue/scanner/BarcodeScannerPanel"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-48 items-center justify-center text-[13px] text-slate-500">
        Loading camera…
      </div>
    ),
  },
);

const SESSION_KEY = "kc.scanner.recent";
const MAX_RECENT = 12;

type SearchHit = {
  kind: "local" | "external" | "recent";
  id?: string;
  barcode?: string;
  name: string;
  brand?: string | null;
  image?: string | null;
  inCatalogue?: boolean;
};

type RecentScan = {
  barcode: string;
  name: string;
  brand?: string | null;
  image?: string | null;
  inCatalogue?: boolean;
  at: number;
};

type Props = {
  context: ProductScannerContext;
  initialBarcode?: string;
  discoveryId?: string;
  onRequestClose?: () => void;
  className?: string;
  variant?: "popup" | "page";
};

function readRecent(): RecentScan[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentScan[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function writeRecent(items: RecentScan[]) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(items.slice(0, MAX_RECENT)));
  } catch {
    /* ignore */
  }
}

export default function ScannerWorkspace({
  context,
  initialBarcode,
  discoveryId,
  onRequestClose,
  className,
  variant = "popup",
}: Props) {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResolveResult | null>(null);
  const [selectedBarcode, setSelectedBarcode] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [scannerKey, setScannerKey] = useState(0);
  const [searchQ, setSearchQ] = useState("");
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [recent, setRecent] = useState<RecentScan[]>([]);
  const reviewingBarcodeRef = useRef<string | null>(null);
  const lastReviewAtRef = useRef(0);
  const bootKeyRef = useRef("");
  const [categories, setCategories] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [brands, setBrands] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    setRecent(readRecent());
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/catalogue/meta");
        const data = await res.json();
        setCategories(
          (data.categories || []).map(
            (c: { id?: string; public_id?: string; name: string }) => ({
              id: c.public_id || c.id || "",
              name: c.name,
            }),
          ),
        );
        setBrands(
          (data.brands || []).map(
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

  const pushRecent = useCallback((entry: Omit<RecentScan, "at">) => {
    setRecent((prev) => {
      const next = [
        { ...entry, at: Date.now() },
        ...prev.filter((r) => r.barcode !== entry.barcode),
      ].slice(0, MAX_RECENT);
      writeRecent(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setSelectedBarcode(null);
    setError(null);
    setShowCreate(false);
    setCameraOpen(false);
    reviewingBarcodeRef.current = null;
  }, []);

  const openCamera = useCallback(() => {
    setCameraOpen(true);
    setScannerKey((k) => k + 1);
  }, []);

  const resolve = useCallback(
    async (barcode: string, formatHint?: string) => {
      const code = barcode.trim();
      if (!code) return;
      if (
        reviewingBarcodeRef.current === code &&
        Date.now() - lastReviewAtRef.current < 2500
      ) {
        return;
      }

      setError(null);
      setLoading(true);
      setStatusText("Looking up…");
      setShowCreate(false);
      setSelectedBarcode(code);
      try {
        const res = await fetch("/api/admin/catalogue/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            barcode: code,
            formatHint,
            discoveryId: discoveryId || undefined,
          }),
        });
        const data = (await res.json()) as ResolveResult & { error?: string };
        if (!res.ok) {
          setError(data.error || "Lookup failed");
          return;
        }
        setResult(data);
        setCameraOpen(false);
        reviewingBarcodeRef.current = data.barcode;
        lastReviewAtRef.current = Date.now();
        pushRecent({
          barcode: data.barcode,
          name:
            data.localProduct?.name ||
            data.candidate?.name?.value ||
            data.barcode,
          brand:
            data.localProduct?.brand ||
            data.candidate?.brand?.value ||
            null,
          image:
            data.localProduct?.image ||
            data.candidate?.images?.[0]?.url ||
            null,
          inCatalogue: Boolean(data.localProduct),
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Lookup failed");
      } finally {
        setLoading(false);
        setStatusText(null);
      }
    },
    [discoveryId, pushRecent],
  );

  useEffect(() => {
    const key = `${initialBarcode || ""}|${discoveryId || ""}|${context}`;
    if (!initialBarcode && !discoveryId) return;
    if (bootKeyRef.current === key) return;
    bootKeyRef.current = key;
    if (discoveryId) {
      void (async () => {
        try {
          const res = await fetch(
            `/api/admin/catalogue/discovery?id=${encodeURIComponent(discoveryId)}`,
          );
          const data = await res.json();
          if (data.item?.barcode) void resolve(data.item.barcode);
        } catch {
          /* ignore */
        }
      })();
      return;
    }
    if (initialBarcode?.trim()) void resolve(initialBarcode.trim());
  }, [initialBarcode, discoveryId, context, resolve]);

  useEffect(() => {
    if (searchQ.trim().length < 2) {
      setSearchHits([]);
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        setSearching(true);
        try {
          const res = await fetch("/api/admin/catalogue/resolve/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ q: searchQ.trim() }),
          });
          const data = await res.json();
          setSearchHits([
            ...(data.local || []).map(
              (l: {
                id: string;
                name: string;
                brand?: string;
                barcode?: string;
                image?: string;
              }) => ({
                kind: "local" as const,
                id: l.id,
                name: l.name,
                brand: l.brand,
                barcode: l.barcode,
                image: l.image,
                inCatalogue: true,
              }),
            ),
            ...(data.external || []).map(
              (e: {
                barcode: string;
                name: string | null;
                brand: string | null;
                image: string | null;
                inCatalogue: boolean;
                localProductId?: string;
              }) => ({
                kind: "external" as const,
                id: e.localProductId,
                barcode: e.barcode,
                name: e.name || e.barcode,
                brand: e.brand,
                image: e.image,
                inCatalogue: e.inCatalogue,
              }),
            ),
          ]);
        } catch {
          setSearchHits([]);
        } finally {
          setSearching(false);
        }
      })();
    }, 320);
    return () => clearTimeout(t);
  }, [searchQ]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = e.target instanceof HTMLElement ? e.target.tagName : "";
      const typing =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (e.target instanceof HTMLElement && e.target.isContentEditable);

      if (e.key === "Escape") {
        if (cameraOpen) {
          e.preventDefault();
          setCameraOpen(false);
          return;
        }
        if (showCreate) {
          e.preventDefault();
          setShowCreate(false);
          return;
        }
        if (result) {
          e.preventDefault();
          reset();
          return;
        }
        if (variant === "popup") {
          e.preventDefault();
          onRequestClose?.();
        }
        return;
      }

      if (typing) return;

      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        openCamera();
        return;
      }
      if (e.key === "/" || e.key === "f" || e.key === "F") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    cameraOpen,
    showCreate,
    result,
    variant,
    onRequestClose,
    reset,
    openCamera,
  ]);

  const onCreated = (id: string) => {
    if (variant === "page") {
      router.push(`/admin/products/${id}`);
      return;
    }
    onRequestClose?.();
    router.push(`/admin/products/${id}`);
  };

  const enqueueVariant = async (hit: SimilarProductHit) => {
    try {
      await fetch("/api/admin/catalogue/discovery", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "enqueue",
          candidate: {
            barcode: hit.barcode,
            name: hit.name,
            brand: hit.brand,
            image: hit.image,
            provider: hit.provider,
          },
        }),
      });
    } catch {
      /* ignore */
    }
  };

  const boardContext =
    context === "page"
      ? "catalogue"
      : context === "discovery"
        ? "discovery"
        : "catalogue";

  const showRecent = searchQ.trim().length < 2 && recent.length > 0;
  const listHits: SearchHit[] = showRecent
    ? recent.map((r) => ({
        kind: "recent" as const,
        barcode: r.barcode,
        name: r.name,
        brand: r.brand,
        image: r.image,
        inCatalogue: r.inCatalogue,
      }))
    : searchHits;

  return (
    <div className={cn("relative flex min-h-0 flex-1 flex-col bg-white", className)}>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            ref={searchInputRef}
            className="h-10 w-full border-0 border-b border-slate-200 bg-transparent pl-6 pr-2 text-[14px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400"
            placeholder="Search name or barcode…  (/)"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchQ.trim()) {
                const digits = searchQ.replace(/\D/g, "");
                if (digits.length >= 8) void resolve(digits);
              }
            }}
          />
        </div>
        <button
          type="button"
          className={cn(
            adminUi.btnPrimary,
            "inline-flex shrink-0 items-center gap-1.5",
          )}
          onClick={openCamera}
          title="Scan (S)"
        >
          <ScanBarcode className="h-4 w-4" />
          Scan
        </button>
        {result ? (
          <button type="button" className={adminUi.btnGhost} onClick={reset}>
            Clear
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="px-5 py-2 text-[12px] text-red-700">{error}</p>
      ) : null}

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(220px,300px)_1fr]">
        <aside className="min-h-0 overflow-y-auto border-b border-slate-100 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-2 px-4 py-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">
              {showRecent ? (
                <span className="inline-flex items-center gap-1">
                  <History className="h-3 w-3" />
                  Session
                </span>
              ) : (
                "Selection"
              )}
              {searching
                ? " · …"
                : listHits.length
                  ? ` · ${listHits.length}`
                  : ""}
            </p>
            {showRecent ? (
              <button
                type="button"
                className="text-[10px] uppercase tracking-[0.1em] text-slate-400 hover:text-slate-700"
                onClick={() => {
                  writeRecent([]);
                  setRecent([]);
                }}
              >
                Clear
              </button>
            ) : null}
          </div>
          {listHits.length ? (
            <ul className="divide-y divide-slate-100">
              {listHits.map((h, i) => {
                const active =
                  selectedBarcode &&
                  h.barcode &&
                  selectedBarcode === h.barcode;
                return (
                  <li key={`${h.kind}-${h.id || h.barcode}-${i}`}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50",
                        active && "bg-slate-50",
                      )}
                      onClick={() => {
                        if (h.barcode) void resolve(h.barcode);
                      }}
                      disabled={!h.barcode || loading}
                    >
                      {h.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={h.image}
                          alt=""
                          className="h-7 w-7 shrink-0 object-contain"
                        />
                      ) : (
                        <div className="h-7 w-7 shrink-0 bg-slate-100" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-medium leading-tight text-slate-900">
                          {h.name}
                        </p>
                        <p className="truncate text-[10px] leading-tight text-slate-400">
                          {[h.brand, h.barcode].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <span className="shrink-0 text-[9px] uppercase tracking-[0.1em] text-slate-400">
                        {h.kind === "recent"
                          ? "Rec"
                          : h.kind === "local" || h.inCatalogue
                            ? "KC"
                            : "Ext"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-4 py-8 text-[12px] text-slate-400">
              {searchQ.trim().length >= 2
                ? "No matches"
                : "Search, scan (S), or open a recent lookup"}
            </p>
          )}
          <p className="border-t border-slate-100 px-4 py-2 text-[10px] text-slate-400">
            Search does not enqueue.{" "}
            <Link
              href="/admin/products/discovery"
              onClick={() => onRequestClose?.()}
              className="underline underline-offset-2"
            >
              Discovery
            </Link>
            <span className="mt-1 block text-slate-300">
              S scan · / focus · Esc back
            </span>
          </p>
        </aside>

        <div className="relative min-h-0 overflow-y-auto px-4 py-5 sm:px-6">
          {loading ? (
            <p className="text-[13px] text-slate-500">
              {statusText || "Looking up…"}
            </p>
          ) : result ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">
                  {context === "discovery"
                    ? "Discovery scan"
                    : context === "page"
                      ? "Scanner"
                      : "Catalogue scan"}
                </p>
                {!result.localProduct ? (
                  <button
                    type="button"
                    className={adminUi.btnPrimary}
                    onClick={() => setShowCreate(true)}
                  >
                    {showCreate ? "Editing…" : "Add as product"}
                  </button>
                ) : null}
              </div>
              <ProductVisualBoard
                result={result}
                context={boardContext}
                onResolveBarcode={(code) => void resolve(code)}
                onEnqueueVariant={
                  context === "discovery" ? enqueueVariant : undefined
                }
              />
              {showCreate && !result.localProduct ? (
                <div className="border-t border-black/[0.06] pt-6">
                  <p className="mb-3 text-[10px] uppercase tracking-[0.14em] text-black/35">
                    Create product
                  </p>
                  <ProductIntelligenceSheet
                    key={result.barcode}
                    result={result}
                    categories={categories}
                    brands={brands}
                    onScanAnother={reset}
                    onResolveBarcode={(code) => void resolve(code)}
                    onCreated={onCreated}
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center">
              <ScanBarcode className="h-8 w-8 text-slate-300" />
              <p className="mt-3 text-[14px] text-slate-500">
                Select a product or scan a barcode
              </p>
              <p className="mt-1 max-w-sm text-[12px] text-slate-400">
                Visual scores, nutrition, and provenance appear here after
                lookup. Press S to open the camera.
              </p>
            </div>
          )}
        </div>
      </div>

      {cameraOpen ? (
        <div className="absolute inset-0 z-20 flex items-end justify-center bg-slate-900/40 p-3 backdrop-blur-[1px] sm:items-center">
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                Scan barcode
              </p>
              <button
                type="button"
                onClick={() => setCameraOpen(false)}
                className="text-slate-400 hover:text-slate-900"
                aria-label="Close camera"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <BarcodeScannerPanel
              key={scannerKey}
              active={cameraOpen && !loading}
              fullscreen={false}
              hideHeader
              autoSubmit
              className="bg-white"
              onDetected={(code, meta) => {
                void resolve(code, meta?.format);
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
