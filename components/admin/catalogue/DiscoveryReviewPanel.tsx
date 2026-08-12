"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProductDataVisual from "@/components/admin/catalogue/ProductDataVisual";
import ProductIntelligenceSheet from "@/components/admin/catalogue/resolver/ProductIntelligenceSheet";
import { adminUi } from "@/components/admin/admin-ui";
import type {
  DiscoveryCandidateRow,
  ResolveResult,
  SimilarProductHit,
} from "@/lib/product-resolver/types";
import { cn } from "@/lib/utils";

type Props = {
  barcode: string;
  discoveryId?: string | null;
  /** Seed preview while resolve loads */
  seed?: Pick<
    DiscoveryCandidateRow,
    "name" | "brand" | "barcode" | "preview" | "payload" | "status" | "source" | "provider"
  > | null;
  onClose: () => void;
  onDismiss?: () => void;
  onCreated?: (productId: string) => void;
};

/**
 * Review dashboard for a discovery candidate: resolve → visualize → create.
 * Not a camera scanner.
 */
export default function DiscoveryReviewPanel({
  barcode,
  discoveryId,
  seed,
  onClose,
  onDismiss,
  onCreated,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResolveResult | null>(null);
  const [categories, setCategories] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [brands, setBrands] = useState<Array<{ id: string; name: string }>>([]);

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

  const resolve = useCallback(
    async (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/catalogue/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            barcode: trimmed,
            discoveryId: discoveryId || undefined,
          }),
        });
        const data = (await res.json()) as ResolveResult & { error?: string };
        if (!res.ok) {
          setError(data.error || "Lookup failed");
          return;
        }
        setResult(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Lookup failed");
      } finally {
        setLoading(false);
      }
    },
    [discoveryId],
  );

  useEffect(() => {
    void resolve(barcode);
  }, [barcode, resolve]);

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

  const handleCreated = (id: string) => {
    onCreated?.(id);
    onClose();
    router.push(`/admin/products/${id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-black/[0.06] pb-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-black/35">
            Review dashboard
          </p>
          <h2 className="mt-1 text-[18px] font-medium tracking-tight text-black">
            {result?.localProduct?.name ||
              result?.candidate?.name?.value ||
              seed?.name ||
              barcode}
          </h2>
          <p className="mt-0.5 text-[12px] text-black/45">
            {[
              result?.localProduct?.brand ||
                result?.candidate?.brand?.value ||
                seed?.brand,
              seed?.provider || result?.providerResults?.[0]?.provider,
              barcode,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onDismiss ? (
            <button
              type="button"
              className={adminUi.btnGhost}
              onClick={onDismiss}
            >
              Dismiss
            </button>
          ) : null}
          <button type="button" className={adminUi.btnGhost} onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {error ? <p className="text-[12px] text-red-700">{error}</p> : null}
      {loading ? (
        <p className="text-[13px] text-black/45">Loading product intelligence…</p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)]">
        <div className="min-w-0 space-y-4">
          <p className="text-[10px] uppercase tracking-[0.14em] text-black/35">
            Intelligence
          </p>
          {result ? (
            <ProductDataVisual
              data={{
                name: result.localProduct?.name || result.candidate?.name?.value,
                brand:
                  result.localProduct?.brand || result.candidate?.brand?.value,
                barcode: result.barcode,
                format: result.format,
                image:
                  result.localProduct?.image ||
                  result.candidate?.images?.[0]?.url,
                quantity: result.candidate?.quantity?.value,
                statusLabel: result.resolutionStatus.replace(/_/g, " "),
                localProduct: result.localProduct,
                candidate: result.candidate,
                providerResults: result.providerResults,
                similarProducts: result.similarProducts,
                showVariants: true,
              }}
              onResolveBarcode={(code) => void resolve(code)}
              onEnqueueVariant={enqueueVariant}
            />
          ) : seed ? (
            <ProductDataVisual
              data={{
                name: seed.name,
                brand: seed.brand,
                barcode: seed.barcode,
                image: seed.preview?.image,
                quantity: seed.preview?.quantity,
                statusLabel: `${seed.status} · ${seed.source}`,
                candidate: seed.payload as never,
              }}
            />
          ) : !loading ? (
            <p className="text-[13px] text-black/40">No data for this barcode.</p>
          ) : null}
        </div>

        <div className="min-w-0 space-y-3 lg:border-l lg:border-black/[0.06] lg:pl-8">
          <p className="text-[10px] uppercase tracking-[0.14em] text-black/35">
            Actions
          </p>
          {result?.localProduct ? (
            <div className="space-y-3">
              <p className="text-[13px] text-black/55">
                Already in the catalogue.
              </p>
              <Link
                href={`/admin/products/${result.localProduct.id}`}
                className={cn(adminUi.btnPrimary, "inline-flex")}
                onClick={onClose}
              >
                Open product
              </Link>
            </div>
          ) : result && !result.localProduct ? (
            <ProductIntelligenceSheet
              key={result.barcode}
              result={result}
              categories={categories}
              brands={brands}
              onScanAnother={onClose}
              onResolveBarcode={(code) => void resolve(code)}
              onCreated={handleCreated}
            />
          ) : loading ? (
            <p className="text-[12px] text-black/40">Preparing create form…</p>
          ) : (
            <p className="text-[12px] text-black/40">
              Resolve a barcode to create a product.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
