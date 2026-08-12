"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CompareSourcesScreen from "@/components/admin/catalogue/scanner/screens/CompareSourcesScreen";
import HistoryScreen, {
  type RecentScanEntry,
} from "@/components/admin/catalogue/scanner/screens/HistoryScreen";
import ManualEntryScreen from "@/components/admin/catalogue/scanner/screens/ManualEntryScreen";
import ReviewCreateScreen from "@/components/admin/catalogue/scanner/screens/ReviewCreateScreen";
import ScanResultScreen from "@/components/admin/catalogue/scanner/screens/ScanResultScreen";
import ScanScreen from "@/components/admin/catalogue/scanner/screens/ScanScreen";
import type { ProductScannerContext } from "@/lib/admin/product-scanner-events";
import { scoreMatchConfidence } from "@/lib/product-resolver/match-confidence";
import {
  enqueueOfflineScan,
  isBrowserOnline,
} from "@/lib/catalogue/offline-scan-queue";
import type {
  ResolveResult,
  SimilarProductHit,
} from "@/lib/product-resolver/types";
import { cn } from "@/lib/utils";

const SESSION_KEY = "kc.scanner.recent";
const MAX_RECENT = 12;

type Screen = "scan" | "manual" | "history" | "result" | "compare" | "review";

type Props = {
  context: ProductScannerContext;
  initialBarcode?: string;
  discoveryId?: string;
  onRequestClose?: () => void;
  className?: string;
  variant?: "popup" | "page";
};

function readRecent(): RecentScanEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentScanEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function writeRecent(items: RecentScanEntry[]) {
  try {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify(items.slice(0, MAX_RECENT)),
    );
  } catch {
    /* ignore */
  }
}

/**
 * Scanner orchestrator: renders one pop-up screen at a time
 * (scan → manual / history / result → compare / review).
 */
export default function ScannerWorkspace({
  context,
  initialBarcode,
  discoveryId,
  onRequestClose,
  className,
  variant = "popup",
}: Props) {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>("scan");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResolveResult | null>(null);
  const [lastBarcode, setLastBarcode] = useState<string | null>(null);
  const [continuous, setContinuous] = useState(variant === "page");
  const [resumeKey, setResumeKey] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [recent, setRecent] = useState<RecentScanEntry[]>([]);
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

  const pushRecent = useCallback((entry: Omit<RecentScanEntry, "at">) => {
    setRecent((prev) => {
      const next = [
        { ...entry, at: Date.now() },
        ...prev.filter((r) => r.barcode !== entry.barcode),
      ].slice(0, MAX_RECENT);
      writeRecent(next);
      return next;
    });
  }, []);

  /** Return to a live camera, clearing the current result. */
  const keepScanning = useCallback(() => {
    setScreen("scan");
    setShowCreate(false);
    setResult(null);
    setError(null);
    setLastBarcode(null);
    setResumeKey((k) => k + 1);
    reviewingBarcodeRef.current = null;
  }, []);

  /** Return to the camera without discarding an in-flight result. */
  const backToScan = useCallback(() => {
    setScreen("scan");
    setError(null);
    setResumeKey((k) => k + 1);
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
      setResult(null);
      setLastBarcode(code);
      setShowCreate(false);
      setScreen("result");
      try {
        if (!isBrowserOnline()) {
          await enqueueOfflineScan({
            barcode: code,
            formatHint,
            discoveryId: discoveryId || null,
            context,
          });
          setError(
            "You are offline — scan queued locally and will sync when online.",
          );
          pushRecent({
            barcode: code,
            name: "Queued offline",
            inCatalogue: false,
          });
          return;
        }
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
        reviewingBarcodeRef.current = data.barcode;
        lastReviewAtRef.current = Date.now();
        pushRecent({
          barcode: data.barcode,
          name:
            data.localProduct?.name ||
            data.candidate?.name?.value ||
            data.barcode,
          brand:
            data.localProduct?.brand || data.candidate?.brand?.value || null,
          image:
            data.localProduct?.image ||
            data.candidate?.images?.[0]?.url ||
            null,
          inCatalogue: Boolean(data.localProduct),
        });
      } catch (e) {
        try {
          await enqueueOfflineScan({
            barcode: code,
            formatHint,
            discoveryId: discoveryId || null,
            context,
          });
          setError(
            "Network error — scan queued offline for sync when connection returns.",
          );
        } catch {
          setError(e instanceof Error ? e.message : "Lookup failed");
        }
      } finally {
        setLoading(false);
      }
    },
    [context, discoveryId, pushRecent],
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
    const onKey = (e: KeyboardEvent) => {
      const tag = e.target instanceof HTMLElement ? e.target.tagName : "";
      const typing =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (e.target instanceof HTMLElement && e.target.isContentEditable);
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (screen === "compare" || screen === "review") {
          setShowCreate(false);
          setScreen("result");
          return;
        }
        if (screen === "result") {
          keepScanning();
          return;
        }
        if (screen === "manual" || screen === "history") {
          backToScan();
          return;
        }
        onRequestClose?.();
        return;
      }
      if (typing) return;
      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        setContinuous((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, keepScanning, backToScan, onRequestClose]);

  const onCreated = (id: string) => {
    if (continuous) {
      keepScanning();
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

  const conf = result ? scoreMatchConfidence(result) : null;
  const contextLabel = context === "discovery" ? "Discovery" : "Catalogue";
  const boardContext = context === "discovery" ? "discovery" : "catalogue";

  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-black",
        className,
      )}
    >
      <ScanScreen
        active={screen === "scan"}
        continuous={continuous}
        resumeKey={resumeKey}
        contextLabel={contextLabel}
        variant={variant}
        historyCount={recent.length}
        error={screen === "scan" ? error : null}
        onDetected={(code, format) => void resolve(code, format)}
        onToggleContinuous={() => setContinuous((v) => !v)}
        onOpenManual={() => setScreen("manual")}
        onOpenHistory={() => setScreen("history")}
        onRequestClose={onRequestClose}
      />

      {screen === "manual" ? (
        <ManualEntryScreen
          contextLabel={contextLabel}
          onBack={backToScan}
          onSubmit={(code) => void resolve(code)}
        />
      ) : null}

      {screen === "history" ? (
        <HistoryScreen
          contextLabel={contextLabel}
          recent={recent}
          onBack={backToScan}
          onSelect={(code) => void resolve(code)}
        />
      ) : null}

      {screen === "result" ? (
        <ScanResultScreen
          contextLabel={contextLabel}
          loading={loading}
          result={result}
          error={error}
          barcode={lastBarcode}
          continuous={continuous}
          onBack={keepScanning}
          onScanAnother={keepScanning}
          onReview={() => setScreen("review")}
          onCompare={() => setScreen("compare")}
          onCreate={() => {
            setShowCreate(true);
            setScreen("review");
          }}
        />
      ) : null}

      {screen === "compare" && result ? (
        <CompareSourcesScreen
          contextLabel={contextLabel}
          result={result}
          onBack={() => setScreen("result")}
        />
      ) : null}

      {screen === "review" && result ? (
        <ReviewCreateScreen
          contextLabel={contextLabel}
          result={result}
          conf={conf}
          continuous={continuous}
          showCreate={showCreate}
          categories={categories}
          brands={brands}
          boardContext={boardContext}
          onBack={() => {
            setShowCreate(false);
            setScreen("result");
          }}
          onKeepScanning={keepScanning}
          onStartCreate={() => setShowCreate(true)}
          onResolveBarcode={(code) => void resolve(code)}
          onEnqueueVariant={
            context === "discovery" ? enqueueVariant : undefined
          }
          onCreated={onCreated}
        />
      ) : null}
    </div>
  );
}
