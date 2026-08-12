"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ScanBarcode, X } from "lucide-react";
import { adminUi } from "@/components/admin/admin-ui";
import dynamic from "next/dynamic";

const CatalogueBarcodeScanner = dynamic(
  () => import("@/components/admin/catalogue/CatalogueBarcodeScanner"),
  { ssr: false },
);
import { useIsClient } from "@/lib/hooks/useIsClient";
import {
  emptyDraft,
  PRODUCT_KINDS,
  kindNeedsVariants,
  type CatalogueDraft,
  type ProductKind,
  type SaleUnit,
  warnWeakProductName,
} from "@/lib/catalogue/product-draft";
import { evaluateCompleteness } from "@/lib/catalogue/completeness";
import { generateSku } from "@/lib/catalogue/sku";
import { productSlugify } from "@/lib/catalogue/slug";
import { validateGtin } from "@/lib/catalogue/gtin";
import {
  estimateVariantCount,
  generateVariantCombos,
} from "@/lib/catalogue/variants";
import { attributesForCategoryPath } from "@/lib/catalogue/attribute-templates";
import { cn } from "@/lib/utils";

type StepId =
  | "kind"
  | "identity"
  | "duplicates"
  | "classification"
  | "information"
  | "media"
  | "variants"
  | "guide"
  | "seo"
  | "review"
  | "publish";

const STEP_LABEL: Record<StepId, string> = {
  kind: "Product type",
  identity: "Product identity",
  duplicates: "Duplicate check",
  classification: "Classification",
  information: "Product information",
  media: "Media",
  variants: "Variants",
  guide: "Guide prices",
  seo: "SEO & discoverability",
  review: "Review",
  publish: "Publish",
};

type MetaBrand = { public_id: string; name: string };
type MetaCategory = {
  id: string;
  public_id: string;
  name: string;
  parent_id: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  initialProductId?: string | null;
  initialBarcode?: string | null;
};

function flowForKind(kind?: ProductKind): StepId[] {
  const base: StepId[] = [
    "kind",
    "identity",
    "duplicates",
    "classification",
    "information",
    "media",
  ];
  if (kindNeedsVariants(kind)) base.push("variants");
  base.push("guide", "seo", "review", "publish");
  return base;
}

const field =
  "w-full border-0 border-b border-black/15 bg-transparent py-3 text-[clamp(1.05rem,2.4vw,1.35rem)] text-black outline-none placeholder:text-black/25 focus:border-black/50";

export default function ProductCreateWizard({
  open,
  onClose,
  initialProductId,
  initialBarcode,
}: Props) {
  const mounted = useIsClient();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<StepId>("kind");
  const [draft, setDraft] = useState<CatalogueDraft>(() => ({
    ...emptyDraft(),
    barcode: initialBarcode || "",
  }));
  const [brands, setBrands] = useState<MetaBrand[]>([]);
  const [categories, setCategories] = useState<MetaCategory[]>([]);
  const [duplicates, setDuplicates] = useState<
    Array<{ publicId: string; name: string; reason: string }>
  >([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [axisName, setAxisName] = useState("Size");
  const [axisValues, setAxisValues] = useState("1kg, 2kg, 5kg");
  const [publishedId, setPublishedId] = useState<string | null>(null);
  const [guideMinMajor, setGuideMinMajor] = useState("");
  const [guideAvgMajor, setGuideAvgMajor] = useState("");
  const [guideMaxMajor, setGuideMaxMajor] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolveNote, setResolveNote] = useState<string | null>(null);

  const flow = useMemo(
    () => flowForKind(draft.productKind),
    [draft.productKind],
  );
  const stepIndex = Math.max(0, flow.indexOf(step));
  const completeness = useMemo(() => evaluateCompleteness(draft), [draft]);

  const patch = useCallback((partial: Partial<CatalogueDraft>) => {
    setDraft((d) => ({ ...d, ...partial }));
  }, []);

  const enrichFromBarcode = useCallback(
    async (code: string, formatHint?: string) => {
      const v = validateGtin(code);
      const digits = v.ok ? v.digits : code.replace(/\D/g, "") || code;
      setResolving(true);
      setResolveNote(null);
      setError(null);
      try {
        const res = await fetch("/api/admin/catalogue/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ barcode: digits, formatHint }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Barcode lookup failed");
          patch({ barcode: digits, gtin: v.ok ? v.digits : digits });
          return;
        }
        if (data.localProduct?.id) {
          setResolveNote(
            `Already in catalogue: ${data.localProduct.name}. Open that product instead of creating a duplicate.`,
          );
          patch({
            barcode: data.barcode || digits,
            gtin: data.barcode || digits,
          });
          return;
        }
        const c = data.candidate;
        const attrs: Record<string, string> = {};
        if (c?.ingredients?.value) attrs.ingredients = String(c.ingredients.value);
        if (c?.allergens?.value) attrs.allergens = String(c.allergens.value);
        if (c?.quantity?.value) attrs.quantity = String(c.quantity.value);
        if (c?.nutriscore?.value) attrs.nutriscore = String(c.nutriscore.value);
        const imageUrl = c?.images?.[0]?.url || null;
        patch({
          barcode: data.barcode || digits,
          gtin: data.barcode || digits,
          productKind: draft.productKind || "packaged_grocery",
          name: c?.name?.value || draft.name || "",
          brandName: c?.brand?.value || draft.brandName || null,
          description:
            c?.description?.value ||
            c?.genericName?.value ||
            draft.description ||
            "",
          attributes: { ...(draft.attributes || {}), ...attrs },
          imageUrl: imageUrl || draft.imageUrl,
          images: imageUrl
            ? [imageUrl, ...(draft.images || []).filter((u) => u !== imageUrl)]
            : draft.images,
          status: "pending_review",
        });
        setResolveNote(
          c?.name?.value
            ? "Enriched from product databases — review every field before saving."
            : "No external product data. Fill in details manually.",
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Barcode lookup failed");
        patch({ barcode: digits, gtin: v.ok ? v.digits : digits });
      } finally {
        setResolving(false);
      }
    },
    [draft.attributes, draft.description, draft.imageUrl, draft.images, draft.name, draft.brandName, draft.productKind, patch],
  );

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const res = await fetch("/api/admin/catalogue/meta");
      const data = await res.json();
      setBrands(data.brands || []);
      setCategories(data.categories || []);
    })();
  }, [open]);

  useEffect(() => {
    if (!open || !initialBarcode || initialProductId) return;
    void enrichFromBarcode(initialBarcode);
    // Only on open with an initial barcode
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialBarcode, initialProductId]);

  useEffect(() => {
    if (!open || !initialProductId) return;
    void (async () => {
      const res = await fetch(
        `/api/admin/catalogue/products/${initialProductId}`,
      );
      const data = await res.json();
      if (!data.product) return;
      const p = data.product;
      setDraft({
        ...emptyDraft(),
        publicId: p.id,
        version: p.version,
        name: p.name || "",
        productKind: p.productKind || "branded",
        saleUnit: p.saleUnit || "each",
        description: p.description || "",
        longDescription: p.longDescription || "",
        sku: p.sku || "",
        barcode: p.barcode || initialBarcode || "",
        gtin: p.gtin || "",
        manufacturer: p.manufacturer || "",
        mpn: p.mpn || "",
        brandId: p.brandId,
        brandName: p.brandName,
        categoryId: p.categoryId,
        categoryPath: p.categoryName,
        imageUrl: p.image,
        images: p.images || [],
        media: (p.media || []).map(
          (m: {
            id?: string;
            url: string;
            role: "main" | "gallery" | "variant";
            sortOrder?: number;
          }) => ({
            publicId: m.id,
            url: m.url,
            role: m.role,
            sortOrder: m.sortOrder,
          }),
        ),
        optionAxes: p.optionAxes || [],
        variants: p.variants || [],
        seoTitle: p.seoTitle,
        seoDescription: p.seoDescription,
        slug: p.slug,
        attributes: p.attributes || {},
        specs: p.specs || [],
        perishability: p.perishability,
        status: p.status,
        guidePriceMinMinor: p.guidePriceMinMinor,
        guidePriceAvgMinor: p.guidePriceAvgMinor,
        guidePriceMaxMinor: p.guidePriceMaxMinor,
      });
      setGuideMinMajor(
        p.guidePriceMinMinor != null
          ? String(Math.round(Number(p.guidePriceMinMinor) / 100))
          : "",
      );
      setGuideAvgMajor(
        p.guidePriceAvgMinor != null
          ? String(Math.round(Number(p.guidePriceAvgMinor) / 100))
          : "",
      );
      setGuideMaxMajor(
        p.guidePriceMaxMinor != null
          ? String(Math.round(Number(p.guidePriceMaxMinor) / 100))
          : "",
      );
      setStep("identity");
    })();
  }, [open, initialProductId, initialBarcode]);

  const autosave = useCallback(async () => {
    if (!draft.name?.trim() && !draft.productKind) return;
    if (!draft.name?.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const method = draft.publicId ? "PATCH" : "POST";
      const body = {
        ...draft,
        sku: draft.sku || generateSku(draft.name),
        slug: draft.slug || productSlugify(draft.name),
        guidePriceMinMinor: guideMinMajor
          ? Math.round(Number(guideMinMajor) * 100)
          : draft.guidePriceMinMinor,
        guidePriceAvgMinor: guideAvgMajor
          ? Math.round(Number(guideAvgMajor) * 100)
          : draft.guidePriceAvgMinor,
        guidePriceMaxMinor: guideMaxMajor
          ? Math.round(Number(guideMaxMajor) * 100)
          : draft.guidePriceMaxMinor,
      };
      const res = await fetch("/api/admin/catalogue/products", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setDraft((d) => ({
        ...d,
        publicId: data.product.id,
        version: data.product.version,
        sku: data.product.sku,
        slug: data.product.slug,
        guidePriceMinMinor: data.product.guidePriceMinMinor,
        guidePriceAvgMinor: data.product.guidePriceAvgMinor,
        guidePriceMaxMinor: data.product.guidePriceMaxMinor,
      }));
      setLastSavedAt(new Date());
      return data.product.id as string;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      return null;
    } finally {
      setSaving(false);
    }
  }, [draft, guideMinMajor, guideAvgMajor, guideMaxMajor]);

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => {
      void autosave();
    }, 8000);
    return () => clearInterval(t);
  }, [open, autosave]);

  const persistMedia = useCallback(
    async (
      media: NonNullable<CatalogueDraft["media"]>,
      productId?: string,
    ) => {
      const id = productId || draft.publicId;
      if (!id) return;
      await fetch(`/api/admin/catalogue/products/${id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "media", media }),
      });
    },
    [draft.publicId],
  );

  const uploadImages = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setUploading(true);
    setError(null);

    const previews = list.map((file) => ({
      file,
      localUrl: URL.createObjectURL(file),
    }));
    const localSet = () => new Set(previews.map((p) => p.localUrl));

    // Show local previews immediately while uploads run.
    setDraft((d) => {
      const existing = [...(d.media || [])];
      const pending = previews.map((p, i) => ({
        url: p.localUrl,
        role: (existing.length === 0 && i === 0
          ? "main"
          : "gallery") as "main" | "gallery",
        sortOrder: existing.length + i,
      }));
      const next = [...existing, ...pending];
      return {
        ...d,
        media: next,
        images: next.map((m) => m.url),
        imageUrl:
          next.find((m) => m.role === "main")?.url || next[0]?.url || null,
      };
    });

    const uploadedUrls: string[] = [];
    try {
      let productId = draft.publicId;
      if (!productId) {
        productId = (await autosave()) || undefined;
      }

      for (const { file } of previews) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.url) {
          throw new Error(data.error || `Upload failed for ${file.name}`);
        }
        uploadedUrls.push(data.url as string);
      }

      setDraft((d) => {
        const existing = [...(d.media || [])];
        const locals = localSet();
        const kept = existing.filter((m) => !locals.has(m.url));
        const next = [
          ...kept,
          ...uploadedUrls.map((url, i) => ({
            url,
            role: (kept.length === 0 && i === 0
              ? "main"
              : "gallery") as "main" | "gallery",
            sortOrder: kept.length + i,
          })),
        ];
        if (!next.some((m) => m.role === "main") && next[0]) {
          next[0] = { ...next[0], role: "main" };
        }
        const imageUrl =
          next.find((m) => m.role === "main")?.url || next[0]?.url || null;
        void persistMedia(next, productId || d.publicId);
        return {
          ...d,
          media: next,
          images: next.map((m) => m.url),
          imageUrl,
        };
      });
    } catch (e) {
      setDraft((d) => {
        const locals = localSet();
        const kept = (d.media || []).filter((m) => !locals.has(m.url));
        const next = [
          ...kept,
          ...uploadedUrls.map((url, i) => ({
            url,
            role: (kept.length === 0 && i === 0
              ? "main"
              : "gallery") as "main" | "gallery",
            sortOrder: kept.length + i,
          })),
        ];
        if (!next.some((m) => m.role === "main") && next[0]) {
          next[0] = { ...next[0], role: "main" };
        }
        if (uploadedUrls.length) {
          void persistMedia(next, d.publicId);
        }
        return {
          ...d,
          media: next,
          images: next.map((m) => m.url),
          imageUrl:
            next.find((m) => m.role === "main")?.url || next[0]?.url || null,
        };
      });
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      // Revoke after React can swap to remote URLs.
      requestAnimationFrame(() => {
        previews.forEach((p) => URL.revokeObjectURL(p.localUrl));
      });
    }
  };

  const runDuplicateCheck = useCallback(async () => {
    const res = await fetch("/api/admin/catalogue/duplicates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: draft.name,
        sku: draft.sku,
        barcode: draft.barcode,
        gtin: draft.gtin,
        mpn: draft.mpn,
        brandName: draft.brandName,
        excludePublicId: draft.publicId,
      }),
    });
    const data = await res.json();
    setDuplicates(data.matches || []);
  }, [draft]);

  const syncGuideToDraft = () => {
    const min = guideMinMajor ? Math.round(Number(guideMinMajor) * 100) : null;
    const avg = guideAvgMajor ? Math.round(Number(guideAvgMajor) * 100) : null;
    const max = guideMaxMajor ? Math.round(Number(guideMaxMajor) * 100) : null;
    patch({
      guidePriceMinMinor: min,
      guidePriceAvgMinor: avg,
      guidePriceMaxMinor: max,
    });
    return { min, avg, max };
  };

  const canContinue = useMemo(() => {
    if (step === "kind") return Boolean(draft.productKind);
    if (step === "identity") {
      const nameOk =
        Boolean(draft.name.trim()) &&
        !warnWeakProductName(draft.name)?.includes("required");
      if (draft.productKind === "branded") {
        return nameOk && Boolean(draft.brandName || draft.brandId);
      }
      if (
        draft.productKind === "fresh_weight" ||
        draft.productKind === "variable_bulk"
      ) {
        return nameOk && Boolean(draft.saleUnit);
      }
      return nameOk;
    }
    if (step === "duplicates") {
      return duplicates.length === 0 || Boolean(draft.duplicateAck);
    }
    if (step === "classification") return Boolean(draft.categoryId);
    if (step === "information")
      return (draft.description || "").trim().length >= 8;
    if (step === "media")
      return Boolean(draft.imageUrl || draft.media?.[0]?.url);
    if (step === "guide") {
      const min = Number(guideMinMajor);
      const avg = Number(guideAvgMajor);
      const max = Number(guideMaxMajor);
      return (
        Number.isFinite(min) &&
        Number.isFinite(avg) &&
        Number.isFinite(max) &&
        min > 0 &&
        avg > 0 &&
        max > 0 &&
        min <= avg &&
        avg <= max
      );
    }
    if (step === "seo")
      return Boolean((draft.slug || productSlugify(draft.name)).trim());
    return true;
  }, [step, draft, duplicates.length, guideMinMajor, guideAvgMajor, guideMaxMajor]);

  const goNext = async () => {
    setError(null);
    if (step === "identity" && draft.barcode) {
      const v = validateGtin(draft.barcode);
      if (!v.ok && draft.productKind === "branded") {
        setError(v.error || "Invalid barcode");
        return;
      }
      if (v.ok) patch({ gtin: v.digits, barcode: v.digits });
    }
    if (step === "guide") {
      const { min, avg, max } = syncGuideToDraft();
      if (
        min == null ||
        avg == null ||
        max == null ||
        min > avg ||
        avg > max
      ) {
        setError("Guide prices must satisfy start ≤ average ≤ end.");
        return;
      }
    }
    await autosave();
    if (step === "identity") await runDuplicateCheck();
    if (step === "media" && draft.media?.length && draft.publicId) {
      await persistMedia(draft.media);
    }
    if (step === "variants" && draft.publicId) {
      await fetch(`/api/admin/catalogue/products/${draft.publicId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "variants",
          optionAxes: draft.optionAxes,
          variants: draft.variants,
        }),
      });
    }
    const next = flow[stepIndex + 1];
    if (next) setStep(next);
  };

  const goBack = () => {
    const prev = flow[stepIndex - 1];
    if (prev) setStep(prev);
  };

  const publish = async (asReview = false, override = false) => {
    syncGuideToDraft();
    await autosave();
    if (!draft.publicId) return;
    let reason: string | undefined;
    if (override) {
      reason =
        window.prompt(
          "Override completeness gate — enter a reason (required):",
        ) || undefined;
      if (!reason?.trim()) {
        setError("Override reason is required");
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/catalogue/products/${draft.publicId}/publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ asReview, override, reason }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish failed");
      setPublishedId(data.product.id);
      setStep("publish");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setSaving(false);
    }
  };

  const generateVariants = () => {
    const values = axisValues
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    const axes = [{ name: axisName.trim() || "Option", values }];
    const combos = generateVariantCombos(axes);
    patch({
      optionAxes: axes,
      variants: combos.map((c) => ({
        title: c.title,
        options: c.options,
        sku: `${draft.sku || "SKU"}-${Object.values(c.options).join("-")}`,
        status: "active",
      })),
    });
  };

  if (!mounted || !open) return null;

  const progressPct = Math.round(((stepIndex + 1) / flow.length) * 100);
  const attrTemplates = attributesForCategoryPath(draft.categoryPath || "");

  const content = (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#f7f7f5]/95 backdrop-blur-xl">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-black/10 px-5 py-4 sm:px-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-black/35">
            Catalogue
          </p>
          <h2
            className="mt-1 text-[22px] font-medium tracking-tight text-black"
            style={{ fontFamily: "var(--font-display), sans-serif" }}
          >
            {draft.publicId ? "Edit product" : "Create product"}
          </h2>
          {lastSavedAt ? (
            <p className="mt-1 text-[12px] text-black/40">
              Last saved {lastSavedAt.toLocaleTimeString()}
              {saving ? " · Saving…" : ""}
            </p>
          ) : (
            <p className="mt-1 text-[12px] text-black/40">
              {saving ? "Saving…" : "Autosaves while you work"}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 w-10 items-center justify-center text-black/45 hover:text-black"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      {step !== "publish" || !publishedId ? (
        <div className="shrink-0 px-5 pt-4 sm:px-8">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-black/40">
            <span>
              Step {stepIndex + 1} of {flow.length}
            </span>
            <span>{progressPct}%</span>
          </div>
          <div className="mt-2 h-px bg-black/10">
            <div
              className="h-px bg-black transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="mt-3 text-[13px] text-black/50">{STEP_LABEL[step]}</p>
        </div>
      ) : null}

      <div className="scrollbar-hide mx-auto min-h-0 w-full max-w-[720px] flex-1 overflow-y-auto px-5 py-8 sm:px-8">
        {error ? (
          <p className="mb-6 border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
            {error}
          </p>
        ) : null}

        {step === "kind" ? (
          <div className="space-y-2">
            <h3 className="text-[clamp(1.4rem,3vw,1.85rem)] font-medium tracking-tight text-black">
              What kind of product is this?
            </h3>
            <p className="mb-6 text-[14px] text-black/45">
              The registration flow adapts to how the item is sold.
            </p>
            {PRODUCT_KINDS.map((k) => {
              const active = draft.productKind === k.id;
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => {
                    const saleUnit: SaleUnit =
                      k.id === "fresh_weight"
                        ? "kg"
                        : k.id === "variable_bulk"
                          ? "kg"
                          : k.id === "packaged_grocery"
                            ? "pack"
                            : "each";
                    patch({
                      productKind: k.id,
                      saleUnit,
                      perishability:
                        k.id === "fresh_weight"
                          ? draft.perishability || "perishable"
                          : draft.perishability,
                    });
                  }}
                  className={cn(
                    "flex w-full items-start justify-between border-b border-black/10 py-4 text-left transition-colors",
                    active ? "text-black" : "text-black/50 hover:text-black/80",
                  )}
                >
                  <span>
                    <span className="block text-[16px] font-medium">{k.label}</span>
                    <span className="mt-1 block text-[13px] text-black/40">
                      {k.description}
                    </span>
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.14em]">
                    {active ? "Selected" : "Select"}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {step === "identity" ? (
          <div className="space-y-8">
            <h3 className="text-[clamp(1.4rem,3vw,1.85rem)] font-medium tracking-tight">
              Identity
            </h3>
            <Field label="Product name" required>
              <input
                className={field}
                value={draft.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="e.g. Brookside Full Cream Milk 1L"
              />
              {warnWeakProductName(draft.name) ? (
                <p className="mt-2 text-[12px] text-black/45">
                  {warnWeakProductName(draft.name)}
                </p>
              ) : null}
            </Field>

            {draft.productKind === "branded" ||
            draft.productKind === "packaged_grocery" ? (
              <>
                <Field
                  label="Brand"
                  required={draft.productKind === "branded"}
                >
                  <input
                    className={field}
                    list="catalogue-brands"
                    value={draft.brandName || ""}
                    onChange={(e) => patch({ brandName: e.target.value })}
                    placeholder="Search or type a brand"
                  />
                  <datalist id="catalogue-brands">
                    {brands.map((b) => (
                      <option key={b.public_id} value={b.name} />
                    ))}
                  </datalist>
                </Field>
                {draft.productKind === "branded" ? (
                  <>
                    <Field label="Manufacturer">
                      <input
                        className={field}
                        value={draft.manufacturer || ""}
                        onChange={(e) =>
                          patch({ manufacturer: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="MPN">
                      <input
                        className={field}
                        value={draft.mpn || ""}
                        onChange={(e) => patch({ mpn: e.target.value })}
                      />
                    </Field>
                  </>
                ) : null}
                <Field
                  label="Barcode / GTIN"
                  required={draft.productKind === "branded"}
                >
                  <div className="flex items-end gap-2">
                    <input
                      className={cn(field, "min-w-0 flex-1")}
                      value={draft.barcode || ""}
                      onChange={(e) => patch({ barcode: e.target.value })}
                      placeholder="Scan or type"
                    />
                    <button
                      type="button"
                      className={cn(
                        adminUi.btnSecondary,
                        "mb-1 inline-flex shrink-0 items-center gap-2",
                      )}
                      disabled={resolving || !draft.barcode?.trim()}
                      onClick={() =>
                        draft.barcode && void enrichFromBarcode(draft.barcode)
                      }
                    >
                      Look up
                    </button>
                    <button
                      type="button"
                      className={cn(
                        adminUi.btnSecondary,
                        "mb-1 inline-flex shrink-0 items-center gap-2",
                      )}
                      onClick={() => setScanOpen(true)}
                      disabled={resolving}
                    >
                      <ScanBarcode className="h-4 w-4" />
                      Scan
                    </button>
                  </div>
                  {resolving ? (
                    <p className="mt-2 text-[12px] text-black/45">
                      Searching product databases…
                    </p>
                  ) : null}
                  {resolveNote ? (
                    <p className="mt-2 text-[12px] text-black/55">{resolveNote}</p>
                  ) : null}
                </Field>
              </>
            ) : null}

            {(draft.productKind === "fresh_weight" ||
              draft.productKind === "variable_bulk") && (
              <>
                <Field label="Barcode (optional)">
                  <div className="flex items-end gap-2">
                    <input
                      className={cn(field, "min-w-0 flex-1")}
                      value={draft.barcode || ""}
                      onChange={(e) => patch({ barcode: e.target.value })}
                      placeholder="Scan or type if available"
                    />
                    <button
                      type="button"
                      className={cn(
                        adminUi.btnSecondary,
                        "mb-1 inline-flex shrink-0 items-center gap-2",
                      )}
                      onClick={() => setScanOpen(true)}
                    >
                      <ScanBarcode className="h-4 w-4" />
                      Scan
                    </button>
                  </div>
                </Field>
                <Field label="Sale unit" required>
                  <select
                    className={field}
                    value={draft.saleUnit || "kg"}
                    onChange={(e) =>
                      patch({ saleUnit: e.target.value as SaleUnit })
                    }
                  >
                    <option value="kg">Kilogram (kg)</option>
                    <option value="g">Gram (g)</option>
                    <option value="l">Litre (L)</option>
                    <option value="each">Each</option>
                    <option value="pack">Pack</option>
                  </select>
                </Field>
                {draft.productKind === "fresh_weight" ? (
                  <Field label="Perishability" required>
                    <select
                      className={field}
                      value={draft.perishability || "perishable"}
                      onChange={(e) =>
                        patch({ perishability: e.target.value })
                      }
                    >
                      <option value="perishable">Perishable</option>
                      <option value="refrigerated">Refrigerated</option>
                      <option value="frozen">Frozen</option>
                      <option value="non_perishable">Non-perishable</option>
                    </select>
                  </Field>
                ) : null}
              </>
            )}

            <Field label="SKU">
              <input
                className={field}
                value={draft.sku || ""}
                onChange={(e) => patch({ sku: e.target.value })}
                placeholder="Auto-generated if empty"
              />
            </Field>
          </div>
        ) : null}

        {step === "duplicates" ? (
          <div className="space-y-4">
            <h3 className="text-[clamp(1.4rem,3vw,1.85rem)] font-medium tracking-tight">
              Possible duplicates
            </h3>
            {!duplicates.length ? (
              <p className="text-[14px] text-black/50">
                No close matches found. You can continue.
              </p>
            ) : (
              <>
                <ul className="space-y-3">
                  {duplicates.map((d) => (
                    <li
                      key={d.publicId}
                      className="border-b border-black/10 py-3 text-[14px]"
                    >
                      <p className="font-medium text-black">{d.name}</p>
                      <p className="text-black/40">{d.reason}</p>
                    </li>
                  ))}
                </ul>
                <label className="mt-4 flex items-center gap-2 text-[13px] text-black/60">
                  <input
                    type="checkbox"
                    checked={Boolean(draft.duplicateAck)}
                    onChange={(e) =>
                      patch({ duplicateAck: e.target.checked })
                    }
                  />
                  I acknowledge these matches and want to continue anyway
                </label>
              </>
            )}
          </div>
        ) : null}

        {step === "classification" ? (
          <div className="space-y-4">
            <h3 className="text-[clamp(1.4rem,3vw,1.85rem)] font-medium tracking-tight">
              Category
            </h3>
            <div className="scrollbar-hide max-h-[50vh] space-y-1 overflow-y-auto">
              {categories.map((c) => {
                const active =
                  draft.categoryId === c.id ||
                  draft.categoryId === c.public_id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      patch({
                        categoryId: c.id,
                        categoryPath: c.name,
                        attributes: {
                          ...(draft.attributes || {}),
                          ...Object.fromEntries(
                            attributesForCategoryPath(c.name).map((a) => [
                              a.key,
                              draft.attributes?.[a.key] || "",
                            ]),
                          ),
                        },
                      })
                    }
                    className={cn(
                      "flex w-full justify-between border-b border-black/10 py-3 text-left text-[15px]",
                      active ? "text-black" : "text-black/50",
                    )}
                  >
                    <span>{c.name}</span>
                    <span className="text-[11px] uppercase tracking-[0.14em]">
                      {active ? "Selected" : "Select"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {step === "information" ? (
          <div className="space-y-8">
            <h3 className="text-[clamp(1.4rem,3vw,1.85rem)] font-medium tracking-tight">
              Information
            </h3>
            <Field label="Short description" required>
              <textarea
                className={cn(field, "min-h-[5rem] resize-y")}
                value={draft.description || ""}
                onChange={(e) => patch({ description: e.target.value })}
              />
            </Field>
            <Field label="Long description">
              <textarea
                className={cn(field, "min-h-[8rem] resize-y")}
                value={draft.longDescription || ""}
                onChange={(e) => patch({ longDescription: e.target.value })}
              />
            </Field>
            {attrTemplates.map((a) => (
              <Field key={a.key} label={a.label}>
                <input
                  className={field}
                  value={draft.attributes?.[a.key] || ""}
                  onChange={(e) =>
                    patch({
                      attributes: {
                        ...(draft.attributes || {}),
                        [a.key]: e.target.value,
                      },
                    })
                  }
                />
              </Field>
            ))}
          </div>
        ) : null}

        {step === "media" ? (
          <div className="space-y-6">
            <h3 className="text-[clamp(1.4rem,3vw,1.85rem)] font-medium tracking-tight">
              Media
            </h3>
            <p className="text-[14px] text-black/45">
              Add multiple images. The first marked main is used on cards and
              PDP. Uploads save to storage and the catalogue immediately.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void uploadImages(e.target.files);
                e.target.value = "";
              }}
            />
            <div
              className="flex min-h-[140px] cursor-pointer flex-col items-center justify-center border border-dashed border-black/20 px-4 py-8 text-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.length)
                  void uploadImages(e.dataTransfer.files);
              }}
              onClick={() => fileRef.current?.click()}
            >
              <p className="text-[13px] uppercase tracking-[0.14em] text-black/45">
                {uploading ? "Uploading…" : "Drop images or click to upload"}
              </p>
              <p className="mt-2 text-[12px] text-black/35">
                JPEG, PNG, WebP, GIF · max 5MB each
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(draft.media || []).map((m, idx) => {
                const isLocalPreview = m.url.startsWith("blob:");
                return (
                  <div
                    key={`${m.url}-${idx}`}
                    className="relative aspect-[4/5] overflow-hidden bg-black/[0.04]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.url}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    {isLocalPreview ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/25 text-[11px] font-medium uppercase tracking-wider text-white">
                        Uploading…
                      </div>
                    ) : null}
                    <div className="absolute inset-x-0 bottom-0 flex gap-1 bg-black/50 p-1.5">
                      <button
                        type="button"
                        disabled={isLocalPreview || uploading}
                        className="flex-1 bg-white/90 px-1 py-1 text-[9px] font-medium uppercase tracking-wider disabled:opacity-50"
                        onClick={() => {
                          const media = (draft.media || []).map((x, i) => ({
                            ...x,
                            role: (i === idx ? "main" : "gallery") as
                              | "main"
                              | "gallery",
                          }));
                          patch({
                            media,
                            imageUrl: media[idx]?.url,
                            images: media.map((x) => x.url),
                          });
                          void persistMedia(media);
                        }}
                      >
                        {m.role === "main" ? "Main" : "Set main"}
                      </button>
                      <button
                        type="button"
                        disabled={isLocalPreview || uploading}
                        className="bg-white/90 px-2 py-1 text-[9px] font-medium uppercase tracking-wider disabled:opacity-50"
                        onClick={() => {
                          const media = (draft.media || []).filter(
                            (_, i) => i !== idx,
                          );
                          if (
                            media.length &&
                            !media.some((x) => x.role === "main")
                          ) {
                            media[0] = { ...media[0], role: "main" };
                          }
                          patch({
                            media,
                            images: media.map((x) => x.url),
                            imageUrl: media.find((x) => x.role === "main")?.url,
                          });
                          void persistMedia(media);
                        }}
                      >
                        Del
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {step === "variants" ? (
          <div className="space-y-6">
            <h3 className="text-[clamp(1.4rem,3vw,1.85rem)] font-medium tracking-tight">
              Variants
            </h3>
            <p className="text-[14px] text-black/45">
              Optional for this product type. Leave empty for a single default
              sellable unit.
            </p>
            <Field label="Option name">
              <input
                className={field}
                value={axisName}
                onChange={(e) => setAxisName(e.target.value)}
              />
            </Field>
            <Field label="Values (comma-separated)">
              <input
                className={field}
                value={axisValues}
                onChange={(e) => setAxisValues(e.target.value)}
              />
            </Field>
            <p className="text-[13px] text-black/45">
              This will create{" "}
              {estimateVariantCount([
                {
                  name: axisName,
                  values: axisValues.split(",").map((v) => v.trim()).filter(Boolean),
                },
              ])}{" "}
              variants
            </p>
            <button
              type="button"
              className={adminUi.btnSecondary}
              onClick={generateVariants}
            >
              Generate matrix
            </button>
            {(draft.variants || []).length ? (
              <ul className="scrollbar-hide max-h-60 space-y-2 overflow-y-auto text-[13px]">
                {draft.variants!.map((v, i) => (
                  <li
                    key={`${v.title}-${i}`}
                    className="flex justify-between border-b border-black/10 py-2"
                  >
                    <span>{v.title}</span>
                    <span className="text-black/40">{v.sku}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {step === "guide" ? (
          <div className="space-y-8">
            <h3 className="text-[clamp(1.4rem,3vw,1.85rem)] font-medium tracking-tight">
              Guide price band
            </h3>
            <p className="text-[14px] text-black/45">
              Admins set a starting, average, and ending reference price
              {draft.saleUnit ? ` per ${draft.saleUnit}` : ""}. Vendors choose
              their own offer price and stock later — these values are advisory
              only.
            </p>
            <Field label="Starting price (KES)" required>
              <input
                className={field}
                inputMode="numeric"
                value={guideMinMajor}
                onChange={(e) => setGuideMinMajor(e.target.value)}
                placeholder="e.g. 150"
              />
            </Field>
            <Field label="Average price (KES)" required>
              <input
                className={field}
                inputMode="numeric"
                value={guideAvgMajor}
                onChange={(e) => setGuideAvgMajor(e.target.value)}
                placeholder="e.g. 185"
              />
            </Field>
            <Field label="Ending price (KES)" required>
              <input
                className={field}
                inputMode="numeric"
                value={guideMaxMajor}
                onChange={(e) => setGuideMaxMajor(e.target.value)}
                placeholder="e.g. 220"
              />
            </Field>
          </div>
        ) : null}

        {step === "seo" ? (
          <div className="space-y-8">
            <h3 className="text-[clamp(1.4rem,3vw,1.85rem)] font-medium tracking-tight">
              SEO
            </h3>
            <Field label="Slug" required>
              <input
                className={field}
                value={draft.slug || ""}
                onChange={(e) => patch({ slug: e.target.value })}
                placeholder={productSlugify(draft.name)}
              />
            </Field>
            <Field label="SEO title">
              <input
                className={field}
                value={draft.seoTitle || ""}
                onChange={(e) => patch({ seoTitle: e.target.value })}
              />
            </Field>
            <Field label="Meta description">
              <textarea
                className={cn(field, "min-h-[5rem] resize-y")}
                value={draft.seoDescription || ""}
                onChange={(e) => patch({ seoDescription: e.target.value })}
              />
            </Field>
            <div className="border border-black/10 bg-white/50 p-4 text-[13px]">
              <p className="text-black/35">Search preview</p>
              <p className="mt-2 text-[16px] text-[#1a0dab]">
                {draft.seoTitle || draft.name || "Product title"}
              </p>
              <p className="text-[12px] text-[#006621]">
                klikcollect.app/products/{draft.slug || "…"}
              </p>
              <p className="mt-1 text-black/55">
                {draft.seoDescription || draft.description || "Description"}
              </p>
            </div>
          </div>
        ) : null}

        {step === "review" ? (
          <div className="space-y-6">
            <h3 className="text-[clamp(1.4rem,3vw,1.85rem)] font-medium tracking-tight">
              Completeness {completeness.score}%
            </h3>
            <ul className="space-y-2 text-[13px]">
              {completeness.items.map((item) => (
                <li
                  key={item.id}
                  className="flex justify-between border-b border-black/10 py-2"
                >
                  <span
                    className={item.ok ? "text-black" : "text-black/40"}
                  >
                    {item.label}
                    {item.required ? " *" : ""}
                  </span>
                  <span className="text-black/35">
                    {item.ok ? "Ready" : item.hint || "Missing"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {step === "publish" && publishedId ? (
          <div className="space-y-6 py-10 text-center">
            <h3 className="text-[clamp(1.4rem,3vw,1.85rem)] font-medium tracking-tight">
              Product registered
            </h3>
            <p className="text-[14px] text-black/50">
              Vendors can now attach their own price and stock for this product.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                className={adminUi.btnPrimary}
                onClick={() => {
                  onClose();
                  router.push(`/admin/products/${publishedId}`);
                }}
              >
                Open product
              </button>
              <button
                type="button"
                className={adminUi.btnSecondary}
                onClick={onClose}
              >
                Back to catalogue
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {step !== "publish" || !publishedId ? (
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-black/10 bg-[#f7f7f5]/95 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-md sm:px-8">
          <button
            type="button"
            className={adminUi.btnGhost}
            onClick={stepIndex === 0 ? onClose : goBack}
          >
            {stepIndex === 0 ? "Cancel" : "Back"}
          </button>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className={adminUi.btnSecondary}
              disabled={saving}
              onClick={() => void autosave()}
            >
              Save draft
            </button>
            {step === "review" || step === "publish" ? (
              <>
                <button
                  type="button"
                  className={adminUi.btnSecondary}
                  disabled={saving || !completeness.canPublish}
                  onClick={() => void publish(true)}
                >
                  Submit for review
                </button>
                <button
                  type="button"
                  className={adminUi.btnPrimary}
                  disabled={saving || !completeness.canPublish}
                  onClick={() => void publish(false)}
                >
                  Publish product
                </button>
                {!completeness.canPublish ? (
                  <button
                    type="button"
                    className={adminUi.btnGhost}
                    disabled={saving}
                    onClick={() => void publish(false, true)}
                  >
                    Override & publish
                  </button>
                ) : null}
              </>
            ) : (
              <button
                type="button"
                className={adminUi.btnPrimary}
                disabled={!canContinue || saving || uploading}
                onClick={() => void goNext()}
              >
                Continue
              </button>
            )}
          </div>
        </footer>
      ) : null}

      <CatalogueBarcodeScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onDetected={(code, meta) => {
          setScanOpen(false);
          void enrichFromBarcode(code, meta?.format);
        }}
      />
    </div>
  );

  return createPortal(content, document.body);
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-black/35">
        {label}
        {required ? " *" : ""}
      </span>
      <div className="mt-2">{children}</div>
    </label>
  );
}
