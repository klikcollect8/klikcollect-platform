"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AccessControl from "@/components/admin/AccessControl";
import { adminUi } from "@/components/admin/admin-ui";
import ProductReviewForm from "@/components/admin/catalogue/resolver/ProductReviewForm";
import ManualCreateFallback from "@/components/admin/catalogue/resolver/ManualCreateFallback";
import type { ResolveResult } from "@/lib/product-resolver/types";
import { cn } from "@/lib/utils";

const BarcodeScannerPanel = dynamic(
  () => import("@/components/admin/catalogue/scanner/BarcodeScannerPanel"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-72 items-center justify-center border border-black/10 text-[14px] text-black/45">
        Loading ZXing scanner…
      </div>
    ),
  },
);

type RecentScan = {
  barcode: string;
  status: string;
  name?: string;
  at: string;
};

export default function CatalogueScannerPage() {
  return (
    <AccessControl requiredPermission="products:view">
      <Suspense
        fallback={
          <div className="px-4 py-8 text-[14px] text-black/45">
            Loading scanner…
          </div>
        }
      >
        <ScannerWorkspace />
      </Suspense>
    </AccessControl>
  );
}

function ScannerWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResolveResult | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [scannerKey, setScannerKey] = useState(0);
  const [categories, setCategories] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [recent, setRecent] = useState<RecentScan[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/catalogue/meta?kind=categories");
        const data = await res.json();
        setCategories(
          (data.categories || []).map(
            (c: { id?: string; public_id?: string; name: string }) => ({
              id: c.public_id || c.id || "",
              name: c.name,
            }),
          ),
        );
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const resolve = useCallback(async (barcode: string, formatHint?: string) => {
    setError(null);
    setLoading(true);
    setPhase("Checking KlikCollect…");
    setResult(null);
    setShowManualForm(false);
    try {
      setPhase("Searching product databases…");
      const res = await fetch("/api/admin/catalogue/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode, formatHint }),
      });
      const data = (await res.json()) as ResolveResult & { error?: string };
      if (!res.ok) {
        setError(data.error || "Lookup failed");
        return;
      }
      setResult(data);
      setRecent((prev) =>
        [
          {
            barcode: data.barcode,
            status: data.resolutionStatus,
            name:
              data.localProduct?.name ||
              data.candidate?.name.value ||
              undefined,
            at: new Date().toISOString(),
          },
          ...prev,
        ].slice(0, 12),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setLoading(false);
      setPhase(null);
    }
  }, []);

  useEffect(() => {
    const q = searchParams.get("barcode");
    if (q?.trim()) void resolve(q.trim());
  }, [searchParams, resolve]);

  const reset = () => {
    setResult(null);
    setError(null);
    setShowManualForm(false);
    setScannerKey((k) => k + 1);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <p className={adminUi.pageEyebrow}>Catalogue</p>
        <h1 className={adminUi.pageTitle}>Product scanner</h1>
        <p className={cn(adminUi.pageDesc, "max-w-xl")}>
          Point the camera at a retail barcode (ZXing live decode), or use a USB
          scanner / manual entry. Results are reviewed before anything is added
          to the catalogue — never auto-published.
        </p>
        <Link href="/admin/products" className={adminUi.btnGhost}>
          ← Back to catalogue
        </Link>
      </header>

      {!result ? (
        <div className="space-y-4">
          <BarcodeScannerPanel
            key={scannerKey}
            active={!loading}
            autoSubmit
            onDetected={(code, meta) => {
              void resolve(code, meta?.format);
            }}
          />

          {loading ? (
            <p className="text-[14px] text-black/55">{phase || "Searching…"}</p>
          ) : null}
          {error ? <p className="text-[13px] text-red-700">{error}</p> : null}

          {recent.length ? (
            <section className="space-y-2">
              <h2 className="text-[11px] uppercase tracking-[0.16em] text-black/40">
                Recent scans
              </h2>
              <ul className="divide-y divide-black/10 border border-black/10">
                {recent.map((r) => (
                  <li
                    key={`${r.barcode}-${r.at}`}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 text-[13px]"
                  >
                    <button
                      type="button"
                      className="text-left"
                      onClick={() => void resolve(r.barcode)}
                    >
                      <p className="font-medium text-black">{r.name || "—"}</p>
                      <p className="font-mono text-black/45">{r.barcode}</p>
                    </button>
                    <span className="text-[11px] uppercase tracking-[0.12em] text-black/40">
                      {r.status.replace(/_/g, " ")}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : (
        <div className="border border-black/10 p-5 sm:p-6">
          {loading ? (
            <p className="text-[14px] text-black/55">{phase}</p>
          ) : result.resolutionStatus === "not_found" &&
            !result.localProduct &&
            !showManualForm ? (
            <ManualCreateFallback
              barcode={result.barcode}
              format={result.format}
              message={result.message}
              onContinue={() => setShowManualForm(true)}
              onScanAnother={reset}
            />
          ) : (
            <ProductReviewForm
              result={result}
              categories={categories}
              onScanAnother={reset}
              onCreated={(id) => {
                router.push(`/admin/products/${id}`);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
