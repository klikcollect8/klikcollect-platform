"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { adminUi } from "@/components/admin/admin-ui";
import ManualCreateFallback from "@/components/admin/catalogue/resolver/ManualCreateFallback";
import {
  candidateToAttributes,
  mapPerishabilityToDb,
} from "@/lib/product-resolver/merge";
import type {
  CandidateField,
  CandidateProduct,
  LocalProductHit,
  ProviderId,
  ResolveResult,
  SimilarProductHit,
} from "@/lib/product-resolver/types";
import { PRODUCT_KINDS, type ProductKind, type SaleUnit } from "@/lib/catalogue/product-draft";
import { cn } from "@/lib/utils";

const PERISHABILITY_OPTIONS = [
  { value: "non_perishable", label: "Ambient / non-perishable" },
  { value: "refrigerated", label: "Chilled / refrigerated" },
  { value: "perishable", label: "Fresh / perishable" },
  { value: "frozen", label: "Frozen" },
] as const;

type CategoryOpt = { id: string; name: string };
type BrandOpt = { id: string; name: string };

type Props = {
  result: ResolveResult;
  categories: CategoryOpt[];
  brands?: BrandOpt[];
  onCreated: (productId: string) => void;
  onScanAnother: () => void;
  onResolveBarcode?: (barcode: string) => void;
};

function Prov({ field }: { field?: CandidateField<unknown> | null }) {
  if (!field || field.status === "missing" || !field.value) {
    return <span className="text-black/30">?</span>;
  }
  const conf =
    field.confidence && field.confidence !== "unknown"
      ? ` · ${field.confidence}`
      : "";
  if (field.provider === "klikcollect") {
    return <span className="text-emerald-800">✓ KC{conf}</span>;
  }
  if (field.provider === "open_food_facts") {
    return <span className="text-emerald-800">✓ OFF{conf}</span>;
  }
  if (field.provider === "open_products_facts") {
    return <span className="text-emerald-800">✓ OPF{conf}</span>;
  }
  return <span className="text-amber-800">⚠{conf}</span>;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 border-t border-black/10 pt-5">
      <h3 className="text-[11px] uppercase tracking-[0.16em] text-black/40">
        {title}
      </h3>
      {children}
    </section>
  );
}

function FieldRow({
  label,
  prov,
  children,
}: {
  label: string;
  prov?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.12em] text-black/40">
        <span>{label}</span>
        {prov}
      </span>
      {children}
    </label>
  );
}

const inputClass = adminUi.input;

export default function ProductIntelligenceSheet({
  result,
  categories,
  brands = [],
  onCreated,
  onScanAnother,
  onResolveBarcode,
}: Props) {
  const local = result.localProduct;
  const c = result.candidate;

  if (local) {
    return (
      <ExistingProductPanel
        product={local}
        result={result}
        message={result.message}
        onScanAnother={onScanAnother}
      />
    );
  }

  if (result.resolutionStatus === "invalid") {
    return (
      <InvalidThenManual
        result={result}
        categories={categories}
        brands={brands}
        onCreated={onCreated}
        onScanAnother={onScanAnother}
        onResolveBarcode={onResolveBarcode}
      />
    );
  }

  return (
    <CreateFromCandidate
      result={result}
      candidate={c}
      categories={categories}
      brands={brands}
      onCreated={onCreated}
      onScanAnother={onScanAnother}
      onResolveBarcode={onResolveBarcode}
    />
  );
}

function InvalidThenManual({
  result,
  categories,
  brands,
  onCreated,
  onScanAnother,
  onResolveBarcode,
}: {
  result: ResolveResult;
  categories: CategoryOpt[];
  brands: BrandOpt[];
  onCreated: (id: string) => void;
  onScanAnother: () => void;
  onResolveBarcode?: (barcode: string) => void;
}) {
  const [forceManual, setForceManual] = useState(false);
  if (!forceManual) {
    return (
      <div className="flex h-full flex-col bg-white">
        <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8">
          <ManualCreateFallback
            barcode={result.barcode}
            format={result.format}
            message={
              result.message ||
              "This barcode failed GTIN checksum validation. Re-scan, or create manually if you are sure of the digits."
            }
            onContinue={() => setForceManual(true)}
            onScanAnother={onScanAnother}
          />
        </div>
      </div>
    );
  }
  return (
    <CreateFromCandidate
      result={{ ...result, resolutionStatus: "not_found", valid: false }}
      candidate={null}
      categories={categories}
      brands={brands}
      onCreated={onCreated}
      onScanAnother={onScanAnother}
      onResolveBarcode={onResolveBarcode}
    />
  );
}

function ExistingProductPanel({
  product,
  result,
  message,
  onScanAnother,
}: {
  product: LocalProductHit;
  result: ResolveResult;
  message: string;
  onScanAnother: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-6 sm:px-8">
        <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-800">
          Already in KlikCollect
        </p>
        <h2 className="text-[28px] font-medium tracking-tight text-black">
          {product.name}
        </h2>
        {message ? (
          <p className="text-[14px] text-black/50">{message}</p>
        ) : null}
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image}
            alt=""
            className="h-48 w-48 object-contain bg-slate-50"
          />
        ) : null}
        <dl className="grid gap-3 text-[14px] sm:grid-cols-2">
          <MetaDt label="Barcode" value={product.barcode || product.gtin || "—"} mono />
          <MetaDt label="SKU" value={product.sku || "—"} mono />
          <MetaDt label="Status" value={product.status} />
          <MetaDt label="Brand" value={product.brand || "—"} />
          <MetaDt label="Category" value={product.categoryName || "—"} />
          <MetaDt
            label="Updated"
            value={
              product.updatedAt
                ? new Date(product.updatedAt).toLocaleString()
                : "—"
            }
          />
          <MetaDt label="Product ID" value={product.id} mono />
          <MetaDt label="Scanned barcode" value={result.barcode} mono />
          <MetaDt label="Format" value={result.format} />
          {result.scanEventId ? (
            <MetaDt label="Scan event" value={result.scanEventId} mono />
          ) : null}
        </dl>
        <IntelligenceDump result={result} candidate={result.candidate} />
      </div>
      <footer className="flex flex-wrap gap-3 border-t border-slate-100 px-5 py-4 sm:px-8">
        <Link
          href={`/admin/products/${product.id}`}
          className={cn(adminUi.btnPrimary)}
        >
          Open product
        </Link>
        <button type="button" className={adminUi.btnGhost} onClick={onScanAnother}>
          Scan another
        </button>
      </footer>
    </div>
  );
}

function MetaDt({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.12em] text-black/40">
        {label}
      </dt>
      <dd className={cn("mt-0.5 text-black/70", mono && "font-mono text-[13px]")}>
        {value}
      </dd>
    </div>
  );
}

function CreateFromCandidate({
  result,
  candidate,
  categories,
  brands,
  onCreated,
  onScanAnother,
  onResolveBarcode,
}: {
  result: ResolveResult;
  candidate: CandidateProduct | null;
  categories: CategoryOpt[];
  brands: BrandOpt[];
  onCreated: (id: string) => void;
  onScanAnother: () => void;
  onResolveBarcode?: (barcode: string) => void;
}) {
  const c = candidate;
  const [name, setName] = useState(c?.name.value || "");
  const [brand, setBrand] = useState(c?.brand.value || "");
  const [brandId, setBrandId] = useState("");
  const [description, setDescription] = useState(
    c?.description.value || c?.genericName.value || "",
  );
  const [quantity, setQuantity] = useState(c?.quantity.value || "");
  const [unit, setUnit] = useState(c?.unit.value || "");
  const [genericName, setGenericName] = useState(c?.genericName.value || "");
  const [ingredients, setIngredients] = useState(c?.ingredients.value || "");
  const [allergens, setAllergens] = useState(c?.allergens.value || "");
  const [additives, setAdditives] = useState(c?.additives.value || "");
  const [traces, setTraces] = useState(c?.traces.value || "");
  const [packaging, setPackaging] = useState(c?.packaging.value || "");
  const [servingSize, setServingSize] = useState(c?.servingSize.value || "");
  const [storage, setStorage] = useState(c?.storage?.value || "");
  const [origins, setOrigins] = useState(c?.origins.value || "");
  const [labelsText, setLabelsText] = useState(
    c?.labels.value?.join(", ") || "",
  );
  const [countriesText, setCountriesText] = useState(
    c?.countries.value?.join(", ") || "",
  );
  const [storesText, setStoresText] = useState(
    c?.stores.value?.join(", ") || "",
  );
  const [manufacturer, setManufacturer] = useState(
    c?.manufacturer.value || "",
  );
  const [categoryId, setCategoryId] = useState("");
  const [productKind, setProductKind] = useState<ProductKind>("packaged_grocery");
  const [saleUnit, setSaleUnit] = useState<SaleUnit>("each");
  const [perishability, setPerishability] = useState("");
  const [mainImageIdx, setMainImageIdx] = useState(0);
  const [activeImage, setActiveImage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fuzzyDups, setFuzzyDups] = useState<
    Array<{ publicId: string; name: string; reason: string }>
  >([]);
  const [duplicateAck, setDuplicateAck] = useState(false);

  const images = c?.images || [];
  const nutrition = c?.nutrition.value;
  const similar = result.similarProducts || [];

  useEffect(() => {
    if (!name.trim() || name.trim().length < 3) return;
    const t = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch("/api/admin/catalogue/duplicates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: name.trim(),
              brandName: brand.trim() || null,
              barcode: result.barcode,
            }),
          });
          const data = await res.json();
          setFuzzyDups(data.matches || data.duplicates || []);
        } catch {
          /* ignore */
        }
      })();
    }, 400);
    return () => clearTimeout(t);
  }, [name, brand, result.barcode]);

  const statusLabel = useMemo(() => {
    switch (result.resolutionStatus) {
      case "external_found":
        return "New from product databases";
      case "partial":
        return "Partial match — review carefully";
      case "not_found":
        return "No external data — enter manually";
      default:
        return result.resolutionStatus.replace(/_/g, " ");
    }
  }, [result.resolutionStatus]);

  const commit = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Product name is required");
      return;
    }
    if (!categoryId) {
      setError("Choose a KlikCollect category");
      return;
    }
    if (fuzzyDups.length && !duplicateAck) {
      setError("Acknowledge possible duplicates before creating");
      return;
    }
    setBusy(true);
    try {
      const attrs = c ? candidateToAttributes(c) : {};
      if (unit.trim()) attrs.unit = unit.trim();
      if (genericName.trim()) attrs.generic_name = genericName.trim();
      if (storage.trim()) attrs.storage = storage.trim();
      if (origins.trim()) {
        attrs.origins = origins.trim();
        attrs.country_of_origin = origins.trim();
      }
      if (quantity.trim()) {
        attrs.quantity = quantity.trim();
        attrs.pack_size = quantity.trim();
      }
      if (labelsText.trim()) attrs.labels = labelsText.trim();
      if (countriesText.trim()) attrs.countries = countriesText.trim();
      if (storesText.trim()) attrs.stores = storesText.trim();

      const prov = (
        fieldKey: string,
        field: CandidateField<unknown> | undefined | null,
        normalised: unknown,
      ) => ({
        fieldKey,
        provider: (field?.provider || "manual") as ProviderId | "manual",
        originalValue: field?.originalValue ?? field?.value,
        normalisedValue: normalised,
        adminOverride:
          JSON.stringify(normalised ?? null) !==
          JSON.stringify(field?.value ?? null),
        confidence: field?.confidence,
        externalProductId: field?.externalProductId,
      });

      const fieldProvenance = [
        prov("name", c?.name, name.trim()),
        prov("brand", c?.brand, brand.trim() || null),
        prov("description", c?.description, description.trim() || null),
        prov("generic_name", c?.genericName, genericName.trim() || null),
        prov("quantity", c?.quantity, quantity.trim() || null),
        prov("unit", c?.unit, unit.trim() || null),
        prov("ingredients", c?.ingredients, ingredients.trim() || null),
        prov("allergens", c?.allergens, allergens.trim() || null),
        prov("additives", c?.additives, additives.trim() || null),
        prov("traces", c?.traces, traces.trim() || null),
        prov("packaging", c?.packaging, packaging.trim() || null),
        prov("serving_size", c?.servingSize, servingSize.trim() || null),
        prov("storage", c?.storage, storage.trim() || null),
        prov("origins", c?.origins, origins.trim() || null),
        prov("manufacturer", c?.manufacturer, manufacturer.trim() || null),
        prov("nutriscore", c?.nutriscore, c?.nutriscore.value || null),
        prov("nova_group", c?.novaGroup, c?.novaGroup.value || null),
        prov("ecoscore", c?.ecoscore, c?.ecoscore.value || null),
        {
          fieldKey: "category",
          provider: "manual" as const,
          originalValue: c?.externalCategories.value,
          normalisedValue: categoryId,
          adminOverride: true,
          confidence: "high" as const,
        },
        {
          fieldKey: "perishability",
          provider: "manual" as const,
          normalisedValue: mapPerishabilityToDb(perishability),
          adminOverride: true,
          confidence: "high" as const,
        },
      ];

      const orderedImages = [...images];
      if (mainImageIdx > 0 && mainImageIdx < orderedImages.length) {
        const [main] = orderedImages.splice(mainImageIdx, 1);
        orderedImages.unshift(main);
      }

      const res = await fetch("/api/admin/catalogue/resolve/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode: result.barcode,
          format: result.format,
          name: name.trim(),
          brand: brand.trim() || null,
          brandId: brandId || null,
          description: description.trim() || null,
          longDescription: ingredients.trim() || null,
          categoryId,
          quantity: quantity.trim() || null,
          unit: unit.trim() || null,
          manufacturer: manufacturer.trim() || null,
          ingredients: ingredients.trim() || null,
          allergens: allergens.trim() || null,
          additives: additives.trim() || null,
          traces: traces.trim() || null,
          packaging: packaging.trim() || null,
          servingSize: servingSize.trim() || null,
          nutriscore: c?.nutriscore.value || null,
          novaGroup: c?.novaGroup.value || null,
          ecoscore: c?.ecoscore.value || null,
          origins: origins.trim() || null,
          labels: labelsText
            .split(/[,|]/)
            .map((s) => s.trim())
            .filter(Boolean),
          countries: countriesText
            .split(/[,|]/)
            .map((s) => s.trim())
            .filter(Boolean),
          stores: storesText
            .split(/[,|]/)
            .map((s) => s.trim())
            .filter(Boolean),
          nutrition: nutrition || null,
          externalCategories: c?.externalCategories.value || [],
          attributes: attrs,
          specs: c?.specs || [],
          imageUrl: orderedImages[0]?.url || null,
          images: orderedImages.map((i) => i.url),
          imageRoles: orderedImages.map((i, idx) => ({
            url: i.url,
            role: idx === 0 ? "front" : i.role,
          })),
          productKind,
          saleUnit,
          perishability: perishability || null,
          status: "pending_review",
          duplicateAck,
          allowInvalidBarcode: result.valid === false,
          discoveryId: result.discoveryId,
          sources: (c?.sources || [])
            .filter((s) => s.provider !== "klikcollect")
            .map((s) => ({
              provider: s.provider,
              externalProductId: s.externalProductId,
              sourceUrl: s.sourceUrl,
            })),
          fieldProvenance,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.duplicate && data.productId) {
          onCreated(data.productId);
          return;
        }
        setError(data.error || "Could not create product");
        return;
      }
      onCreated(data.productId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create product");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-6 sm:px-8">
        <header className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.18em] text-black/40">
            {statusLabel}
          </p>
          <h2 className="text-[28px] font-medium tracking-tight text-black">
            {name || "Untitled product"}
          </h2>
          <p className="font-mono text-[13px] text-black/45">
            {result.format.replace(/_/g, "-")} · {result.barcode}
          </p>
        </header>

        {images.length ? (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[activeImage]?.url}
              alt=""
              className="mx-auto h-56 w-full max-w-sm object-contain border border-black/10 bg-white"
            />
            {images.length > 1 ? (
              <div className="flex flex-wrap gap-2">
                {images.map((img, i) => (
                  <button
                    key={`${img.url}-${i}`}
                    type="button"
                    onClick={() => setActiveImage(i)}
                    className={cn(
                      "border px-2 py-1 text-[11px] uppercase tracking-[0.1em]",
                      i === activeImage
                        ? "border-black bg-black text-white"
                        : "border-black/15",
                    )}
                  >
                    {img.role}
                    {i === mainImageIdx ? " · main" : ""}
                  </button>
                ))}
              </div>
            ) : null}
            {images.length ? (
              <button
                type="button"
                className="text-[12px] text-black/50 underline-offset-2 hover:underline"
                onClick={() => setMainImageIdx(activeImage)}
              >
                Use current image as main
              </button>
            ) : null}
          </div>
        ) : null}

        <Section title="Required for KlikCollect">
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow label="KlikCollect category *">
              <select
                className={inputClass}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">Select category…</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </FieldRow>
            <FieldRow label="Product type *">
              <select
                className={inputClass}
                value={productKind}
                onChange={(e) => setProductKind(e.target.value as ProductKind)}
              >
                {PRODUCT_KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </FieldRow>
            <FieldRow label="Sale unit">
              <select
                className={inputClass}
                value={saleUnit}
                onChange={(e) => setSaleUnit(e.target.value as SaleUnit)}
              >
                <option value="each">Each</option>
                <option value="pack">Pack</option>
                <option value="kg">Kilogram</option>
                <option value="g">Gram</option>
                <option value="l">Litre</option>
              </select>
            </FieldRow>
            <FieldRow label="Perishability">
              <select
                className={inputClass}
                value={perishability}
                onChange={(e) => setPerishability(e.target.value)}
              >
                <option value="">Not set</option>
                {PERISHABILITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </FieldRow>
          </div>
        </Section>

        <Section title="Identity">
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow label="Name *" prov={<Prov field={c?.name} />}>
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </FieldRow>
            <FieldRow label="Brand" prov={<Prov field={c?.brand} />}>
              <input
                className={inputClass}
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
              />
            </FieldRow>
            {brands.length ? (
              <FieldRow label="Link existing brand">
                <select
                  className={inputClass}
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                >
                  <option value="">None — use text above</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </FieldRow>
            ) : null}
            <FieldRow
              label="Generic name"
              prov={<Prov field={c?.genericName} />}
            >
              <input
                className={inputClass}
                value={genericName}
                onChange={(e) => setGenericName(e.target.value)}
              />
            </FieldRow>
            <FieldRow label="Manufacturer" prov={<Prov field={c?.manufacturer} />}>
              <input
                className={inputClass}
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
              />
            </FieldRow>
            <FieldRow label="Quantity / pack" prov={<Prov field={c?.quantity} />}>
              <input
                className={inputClass}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </FieldRow>
            <FieldRow label="Unit" prov={<Prov field={c?.unit} />}>
              <input
                className={inputClass}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="g, ml, kg…"
              />
            </FieldRow>
            <FieldRow label="Serving size" prov={<Prov field={c?.servingSize} />}>
              <input
                className={inputClass}
                value={servingSize}
                onChange={(e) => setServingSize(e.target.value)}
              />
            </FieldRow>
            <FieldRow
              label="Description"
              prov={<Prov field={c?.description} />}
            >
              <textarea
                className={cn(inputClass, "min-h-[80px] resize-y sm:col-span-2")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </FieldRow>
          </div>
        </Section>

        <Section title="Ingredients & allergens">
          <div className="grid gap-4">
            <FieldRow label="Ingredients" prov={<Prov field={c?.ingredients} />}>
              <textarea
                className={cn(inputClass, "min-h-[100px] resize-y")}
                value={ingredients}
                onChange={(e) => setIngredients(e.target.value)}
              />
            </FieldRow>
            <FieldRow label="Allergens" prov={<Prov field={c?.allergens} />}>
              <input
                className={inputClass}
                value={allergens}
                onChange={(e) => setAllergens(e.target.value)}
              />
            </FieldRow>
            <FieldRow label="Traces" prov={<Prov field={c?.traces} />}>
              <input
                className={inputClass}
                value={traces}
                onChange={(e) => setTraces(e.target.value)}
              />
            </FieldRow>
            <FieldRow label="Additives" prov={<Prov field={c?.additives} />}>
              <input
                className={inputClass}
                value={additives}
                onChange={(e) => setAdditives(e.target.value)}
              />
            </FieldRow>
            <div className="flex flex-wrap gap-3 text-[13px]">
              <ScoreChip label="Vegan" value={c?.vegan?.value} />
              <ScoreChip label="Vegetarian" value={c?.vegetarian?.value} />
              <ScoreChip label="Palm oil" value={c?.palmOil?.value} />
            </div>
          </div>
        </Section>

        <Section title="Nutrition & scores">
          <div className="flex flex-wrap gap-4 text-[14px]">
            <ScoreChip label="Nutri-Score" value={c?.nutriscore.value} />
            <ScoreChip label="NOVA" value={c?.novaGroup.value} />
            <ScoreChip label="Eco-Score" value={c?.ecoscore.value} />
            {c?.completeness?.value != null ? (
              <ScoreChip
                label="OFF completeness"
                value={`${c.completeness.value}%`}
              />
            ) : null}
          </div>
          {c?.nutrientLevels?.value ? (
            <div className="mt-2 flex flex-wrap gap-2 text-[12px] text-black/55">
              {Object.entries(c.nutrientLevels.value).map(([k, v]) => (
                <span key={k} className="border border-black/10 px-2 py-1">
                  {k}: {v}
                </span>
              ))}
            </div>
          ) : null}
          {c?.specs?.length ? (
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              {c.specs.map((s) => (
                <div
                  key={s.key}
                  className="flex justify-between gap-3 border-b border-black/5 py-1.5 text-[13px]"
                >
                  <dt className="text-black/45">{s.key}</dt>
                  <dd className="font-medium text-black">{s.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {nutrition ? (
            <pre className="mt-3 max-h-64 overflow-auto bg-slate-50 p-3 text-[11px] text-black/60">
              {JSON.stringify(nutrition, null, 2)}
            </pre>
          ) : !c?.specs?.length ? (
            <p className="text-[13px] text-black/40">No nutrition data</p>
          ) : null}
        </Section>

        <Section title="Packaging & origin">
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow label="Packaging" prov={<Prov field={c?.packaging} />}>
              <input
                className={inputClass}
                value={packaging}
                onChange={(e) => setPackaging(e.target.value)}
              />
            </FieldRow>
            <FieldRow label="Storage" prov={<Prov field={c?.storage} />}>
              <input
                className={inputClass}
                value={storage}
                onChange={(e) => setStorage(e.target.value)}
              />
            </FieldRow>
            <FieldRow label="Origins" prov={<Prov field={c?.origins} />}>
              <input
                className={inputClass}
                value={origins}
                onChange={(e) => setOrigins(e.target.value)}
              />
            </FieldRow>
            <FieldRow label="Labels" prov={<Prov field={c?.labels} />}>
              <input
                className={inputClass}
                value={labelsText}
                onChange={(e) => setLabelsText(e.target.value)}
              />
            </FieldRow>
            <FieldRow label="Countries" prov={<Prov field={c?.countries} />}>
              <input
                className={inputClass}
                value={countriesText}
                onChange={(e) => setCountriesText(e.target.value)}
              />
            </FieldRow>
            <FieldRow label="Stores" prov={<Prov field={c?.stores} />}>
              <input
                className={inputClass}
                value={storesText}
                onChange={(e) => setStoresText(e.target.value)}
              />
            </FieldRow>
          </div>
          <TagList label="External categories" values={c?.externalCategories.value} />
          {(c?.pnnsGroup?.value || c?.foodGroup?.value) && (
            <p className="text-[13px] text-black/55">
              {[c?.pnnsGroup?.value, c?.foodGroup?.value]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {c?.embCodes?.value ? (
            <p className="text-[13px] text-black/55">
              EMB codes: {c.embCodes.value}
            </p>
          ) : null}
          {c?.producerLink?.value ? (
            <a
              href={c.producerLink.value}
              target="_blank"
              rel="noreferrer"
              className="text-[13px] text-black underline-offset-2 hover:underline"
            >
              Producer link
            </a>
          ) : null}
        </Section>

        {fuzzyDups.length ? (
          <Section title="Possible duplicates">
            <ul className="divide-y divide-black/10 border border-black/10">
              {fuzzyDups.map((d) => (
                <li key={d.publicId} className="px-3 py-2 text-[13px]">
                  <Link
                    href={`/admin/products/${d.publicId}`}
                    className="font-medium text-black underline-offset-2 hover:underline"
                  >
                    {d.name}
                  </Link>
                  <p className="text-black/45">{d.reason}</p>
                </li>
              ))}
            </ul>
            <label className="mt-3 flex items-center gap-2 text-[13px] text-black/60">
              <input
                type="checkbox"
                checked={duplicateAck}
                onChange={(e) => setDuplicateAck(e.target.checked)}
              />
              These are different — create anyway
            </label>
          </Section>
        ) : null}

        {similar.length ? (
          <Section title="Similar products">
            <ul className="grid gap-2 sm:grid-cols-2">
              {similar.map((s) => (
                <SimilarRow
                  key={s.barcode}
                  item={s}
                  onOpen={() => {
                    if (s.inCatalogue && s.localProductId) {
                      window.location.href = `/admin/products/${s.localProductId}`;
                    } else {
                      onResolveBarcode?.(s.barcode);
                    }
                  }}
                />
              ))}
            </ul>
          </Section>
        ) : null}

        <IntelligenceDump result={result} candidate={c} />

        {error ? <p className="text-[13px] text-red-700">{error}</p> : null}
      </div>

      <footer className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-5 py-4 sm:px-8">
        <button
          type="button"
          className={adminUi.btnPrimary}
          disabled={busy}
          onClick={() => void commit()}
        >
          {busy ? "Saving…" : "Create KlikCollect product"}
        </button>
        <button type="button" className={adminUi.btnGhost} onClick={onScanAnother}>
          Scan another
        </button>
        <Link href="/admin/products/discovery" className={adminUi.btnGhost}>
          Discovery queue
        </Link>
      </footer>
    </div>
  );
}

function ScoreChip({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="border border-black/10 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.14em] text-black/40">
        {label}
      </p>
      <p className="text-[16px] font-medium text-black">{value || "—"}</p>
    </div>
  );
}

function IntelligenceDump({
  result,
  candidate,
}: {
  result: ResolveResult;
  candidate: CandidateProduct | null;
}) {
  const [rawOpen, setRawOpen] = useState(false);
  const providers = result.providerResults || [];
  const sources = candidate?.sources || [];
  const brandsAll = candidate?.brandsAll?.value;
  const extras = candidate?.extraAttributes || {};
  const fieldRows = useMemo(() => {
    if (!candidate) return [];
    const entries: Array<{
      key: string;
      confidence: string;
      status: string;
      provider: string;
      preview: string;
    }> = [];
    for (const [key, val] of Object.entries(candidate)) {
      if (!val || typeof val !== "object" || !("confidence" in val)) continue;
      const f = val as CandidateField<unknown>;
      const raw = f.value;
      let preview = "—";
      if (raw == null) preview = "—";
      else if (typeof raw === "string") preview = raw.slice(0, 80);
      else if (typeof raw === "number" || typeof raw === "boolean")
        preview = String(raw);
      else if (Array.isArray(raw)) preview = raw.slice(0, 4).join(", ");
      else preview = "{…}";
      entries.push({
        key,
        confidence: f.confidence || "unknown",
        status: f.status || "—",
        provider: f.provider || "—",
        preview,
      });
    }
    return entries;
  }, [candidate]);

  return (
    <>
      <Section title="Provider lookups">
        {providers.length ? (
          <ul className="divide-y divide-black/[0.06]">
            {providers.map((p, i) => (
              <li
                key={`${p.provider}-${i}`}
                className="flex flex-wrap items-start justify-between gap-2 py-2.5 text-[13px]"
              >
                <div className="min-w-0">
                  <p className="font-medium text-black">{p.provider}</p>
                  <p className="text-[12px] text-black/45">
                    {p.status}
                    {p.fromCache ? " · cache" : ""}
                    {p.message ? ` · ${p.message}` : ""}
                  </p>
                  {p.externalProductId ? (
                    <p className="font-mono text-[11px] text-black/35">
                      {p.externalProductId}
                    </p>
                  ) : null}
                </div>
                {p.sourceUrl ? (
                  <a
                    href={p.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[12px] text-black/50 underline-offset-2 hover:underline"
                  >
                    Source
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-black/40">No provider results</p>
        )}
        <dl className="mt-3 grid gap-2 text-[12px] text-black/45 sm:grid-cols-2">
          {result.discoveryId ? (
            <MetaDt label="Discovery ID" value={result.discoveryId} mono />
          ) : null}
          {result.scanEventId ? (
            <MetaDt label="Scan event" value={result.scanEventId} mono />
          ) : null}
          <MetaDt label="Resolution" value={result.resolutionStatus} />
          <MetaDt label="Valid GTIN" value={result.valid ? "yes" : "no"} />
        </dl>
      </Section>

      {sources.length ? (
        <Section title="Provenance sources">
          <ul className="divide-y divide-black/[0.06]">
            {sources.map((s, i) => (
              <li key={`${s.provider}-${i}`} className="py-2.5 text-[13px]">
                <p className="font-medium text-black">{s.provider}</p>
                <p className="font-mono text-[11px] text-black/40">
                  {s.externalProductId || "—"}
                </p>
                {s.sourceUrl ? (
                  <a
                    href={s.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[12px] text-black/50 underline-offset-2 hover:underline"
                  >
                    {s.sourceUrl}
                  </a>
                ) : null}
                {s.fetchedAt ? (
                  <p className="text-[11px] text-black/35">
                    {new Date(s.fetchedAt).toLocaleString()}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {brandsAll || Object.keys(extras).length ? (
        <Section title="Extra attributes">
          {brandsAll ? (
            <p className="mb-3 text-[13px] text-black/60">
              <span className="mr-2 text-[10px] uppercase tracking-[0.14em] text-black/35">
                All brands
              </span>
              {brandsAll}
            </p>
          ) : null}
          {Object.keys(extras).length ? (
            <dl className="grid gap-2 sm:grid-cols-2">
              {Object.entries(extras).map(([k, v]) => (
                <div
                  key={k}
                  className="flex justify-between gap-3 border-b border-black/5 py-1.5 text-[13px]"
                >
                  <dt className="text-black/45">{k}</dt>
                  <dd className="text-right font-medium text-black">{v}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </Section>
      ) : null}

      {fieldRows.length ? (
        <Section title="Field confidence">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left text-[12px]">
              <thead>
                <tr className="border-b border-black/10 text-[10px] uppercase tracking-[0.12em] text-black/40">
                  <th className="py-2 pr-3 font-medium">Field</th>
                  <th className="py-2 pr-3 font-medium">Provider</th>
                  <th className="py-2 pr-3 font-medium">Confidence</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {fieldRows.map((row) => (
                  <tr
                    key={row.key}
                    className="border-b border-black/[0.04] text-black/65"
                  >
                    <td className="py-1.5 pr-3 font-medium text-black/80">
                      {row.key}
                    </td>
                    <td className="py-1.5 pr-3">{row.provider}</td>
                    <td className="py-1.5 pr-3">{row.confidence}</td>
                    <td className="py-1.5 pr-3">{row.status}</td>
                    <td className="max-w-[14rem] truncate py-1.5">{row.preview}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}

      {candidate?.rawSnapshot ? (
        <Section title="Raw snapshot">
          <button
            type="button"
            className="text-[12px] text-black/50 underline-offset-2 hover:underline"
            onClick={() => setRawOpen((o) => !o)}
          >
            {rawOpen ? "Hide" : "Show"} raw provider dump
          </button>
          {rawOpen ? (
            <pre className="mt-3 max-h-80 overflow-auto bg-slate-50 p-3 text-[11px] text-black/60">
              {JSON.stringify(candidate.rawSnapshot, null, 2)}
            </pre>
          ) : null}
        </Section>
      ) : null}
    </>
  );
}

function TagList({
  label,
  values,
}: {
  label: string;
  values?: string[] | null;
}) {
  if (!values?.length) return null;
  return (
    <div className="mb-2">
      <p className="mb-1 text-[11px] uppercase tracking-[0.12em] text-black/40">
        {label}
      </p>
      <p className="text-[13px] text-black/60">{values.join(" · ")}</p>
    </div>
  );
}

function SimilarRow({
  item,
  onOpen,
}: {
  item: SimilarProductHit;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex gap-3 border border-black/10 p-2 text-left transition-opacity hover:opacity-70"
    >
      {item.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.image}
          alt=""
          className="h-14 w-14 shrink-0 object-contain bg-white"
        />
      ) : (
        <div className="h-14 w-14 shrink-0 bg-black/5" />
      )}
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-black">
          {item.name || item.barcode}
        </p>
        <p className="truncate text-[12px] text-black/45">
          {item.brand || "—"} · {item.barcode}
        </p>
        <p className="text-[11px] uppercase tracking-[0.1em] text-black/40">
          {item.inCatalogue ? "In catalogue" : "Not in KlikCollect"}
        </p>
      </div>
    </button>
  );
}
