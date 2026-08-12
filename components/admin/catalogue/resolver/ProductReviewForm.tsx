"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { adminUi } from "@/components/admin/admin-ui";
import { cn } from "@/lib/utils";
import type {
  CandidateField,
  LocalProductHit,
  ProviderId,
  ResolveResult,
} from "@/lib/product-resolver/types";

type ProvProvider = ProviderId | "manual";

type CategoryOpt = { id: string; name: string };

type Props = {
  result: ResolveResult;
  categories: CategoryOpt[];
  onCreated: (productId: string) => void;
  onScanAnother: () => void;
};

function Prov({ field }: { field: CandidateField<unknown> }) {
  if (!field?.value && field?.status === "missing") {
    return <span className="text-black/35">? Missing</span>;
  }
  if (field.status === "needs_review" || !field.provider) {
    return <span className="text-amber-800">⚠ Needs review</span>;
  }
  if (field.provider === "klikcollect") {
    return <span className="text-emerald-800">✓ KlikCollect</span>;
  }
  const label =
    field.provider === "open_food_facts"
      ? "Open Food Facts"
      : field.provider === "open_products_facts"
        ? "Open Products Facts"
        : field.provider;
  return <span className="text-emerald-800">✓ {label}</span>;
}

export default function ProductReviewForm({
  result,
  categories,
  onCreated,
  onScanAnother,
}: Props) {
  const c = result.candidate;
  const local = result.localProduct;

  const [name, setName] = useState(c?.name.value || "");
  const [brand, setBrand] = useState(c?.brand.value || "");
  const [description, setDescription] = useState(
    c?.description.value || c?.genericName.value || "",
  );
  const [quantity, setQuantity] = useState(c?.quantity.value || "");
  const [ingredients, setIngredients] = useState(c?.ingredients.value || "");
  const [allergens, setAllergens] = useState(c?.allergens.value || "");
  const [categoryId, setCategoryId] = useState("");
  const [imageUrl, setImageUrl] = useState(c?.images[0]?.url || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const externalCats = useMemo(() => {
    const v = c?.externalCategories.value;
    return Array.isArray(v) ? v : [];
  }, [c]);

  if (local) {
    return (
      <LocalFoundCard product={local} onScanAnother={onScanAnother} />
    );
  }

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
    setBusy(true);
    try {
      const fieldProvenance: Array<{
        fieldKey: string;
        provider: ProvProvider;
        originalValue?: unknown;
        normalisedValue?: unknown;
        adminOverride?: boolean;
        confidence?: CandidateField["confidence"];
        externalProductId?: string | null;
      }> = [
        {
          fieldKey: "name",
          provider: (c?.name.provider || "manual") as ProvProvider,
          originalValue: c?.name.originalValue ?? c?.name.value,
          normalisedValue: name.trim(),
          adminOverride: name.trim() !== (c?.name.value || ""),
          confidence: c?.name.confidence,
          externalProductId: c?.name.externalProductId,
        },
        {
          fieldKey: "brand",
          provider: (c?.brand.provider || "manual") as ProvProvider,
          originalValue: c?.brand.originalValue ?? c?.brand.value,
          normalisedValue: brand.trim() || null,
          adminOverride: brand.trim() !== (c?.brand.value || ""),
          confidence: c?.brand.confidence,
          externalProductId: c?.brand.externalProductId,
        },
        {
          fieldKey: "category",
          provider: "manual",
          originalValue: externalCats,
          normalisedValue: categoryId,
          adminOverride: true,
          confidence: "high",
        },
      ];

      const res = await fetch("/api/admin/catalogue/resolve/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode: result.barcode,
          format: result.format,
          name: name.trim(),
          brand: brand.trim() || null,
          description: description.trim() || null,
          categoryId,
          quantity: quantity.trim() || null,
          ingredients: ingredients.trim() || null,
          allergens: allergens.trim() || null,
          imageUrl: imageUrl || null,
          images: imageUrl ? [imageUrl] : [],
          externalCategories: externalCats,
          productKind: "packaged_grocery",
          status: "pending_review",
          sources: (c?.sources || [])
            .filter((s) => s.provider !== "klikcollect")
            .map((s) => ({
              provider: s.provider,
              externalProductId: s.externalProductId,
              sourceUrl: s.sourceUrl,
            })),
          fieldProvenance,
          attributes: {
            ...(c?.nutriscore.value
              ? { nutriscore: String(c.nutriscore.value) }
              : {}),
            ...(c?.packaging.value
              ? { packaging: String(c.packaging.value) }
              : {}),
          },
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
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-[11px] uppercase tracking-[0.16em] text-black/40">
          {result.resolutionStatus === "not_found"
            ? "Barcode found, product information unavailable"
            : result.resolutionStatus === "partial"
              ? "Partial match — review carefully"
              : "Product found"}
        </p>
        <h2 className="text-[22px] font-medium tracking-tight text-black">
          {name || "Untitled product"}
        </h2>
        <p className="text-[13px] text-black/50">
          {result.format.replace("_", "-")} · {result.barcode}
        </p>
      </header>

      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className="h-40 w-40 object-contain border border-black/10 bg-white"
        />
      ) : (
        <div className="flex h-40 w-40 items-center justify-center border border-dashed border-black/15 text-[12px] text-black/35">
          No image
        </div>
      )}

      <section className="space-y-3">
        <h3 className="text-[11px] uppercase tracking-[0.16em] text-black/40">
          Identity
        </h3>
        <Field label="Product name" prov={<Prov field={c?.name || { value: null, provider: null, confidence: "unknown", status: "missing" }} />}>
          <input
            className={adminUi.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Brand" prov={<Prov field={c?.brand || { value: null, provider: null, confidence: "unknown", status: "missing" }} />}>
          <input
            className={adminUi.input}
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
          />
        </Field>
        <Field label="Quantity" prov={<Prov field={c?.quantity || { value: null, provider: null, confidence: "unknown", status: "missing" }} />}>
          <input
            className={adminUi.input}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="e.g. 500ml"
          />
        </Field>
        <Field label="Description">
          <textarea
            className={cn(adminUi.input, "min-h-[72px]")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
      </section>

      <section className="space-y-3">
        <h3 className="text-[11px] uppercase tracking-[0.16em] text-black/40">
          Classification
        </h3>
        {externalCats.length ? (
          <p className="text-[13px] text-black/50">
            External: {externalCats.slice(0, 4).join(" · ")}
            <span className="ml-2 text-amber-800">⚠ Needs KlikCollect classification</span>
          </p>
        ) : (
          <p className="text-[13px] text-amber-800">
            ⚠ No external category — choose KlikCollect category
          </p>
        )}
        <Field label="KlikCollect category" required>
          <select
            className={adminUi.input}
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
        </Field>
      </section>

      <section className="space-y-3">
        <h3 className="text-[11px] uppercase tracking-[0.16em] text-black/40">
          Food information
        </h3>
        <Field label="Ingredients" prov={<Prov field={c?.ingredients || { value: null, provider: null, confidence: "unknown", status: "missing" }} />}>
          <textarea
            className={cn(adminUi.input, "min-h-[72px]")}
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
          />
        </Field>
        <Field label="Allergens" prov={<Prov field={c?.allergens || { value: null, provider: null, confidence: "unknown", status: "missing" }} />}>
          <input
            className={adminUi.input}
            value={allergens}
            onChange={(e) => setAllergens(e.target.value)}
          />
        </Field>
        {c?.nutriscore.value ? (
          <p className="text-[13px] text-black/55">
            Nutri-Score: {String(c.nutriscore.value).toUpperCase()}{" "}
            <Prov field={c.nutriscore} />
          </p>
        ) : null}
      </section>

      <section className="space-y-2">
        <h3 className="text-[11px] uppercase tracking-[0.16em] text-black/40">
          Provenance
        </h3>
        <ul className="space-y-1 text-[13px] text-black/55">
          {(c?.sources || []).map((s) => (
            <li key={`${s.provider}-${s.externalProductId}`}>
              {s.provider.replace(/_/g, " ")}
              {s.sourceUrl ? (
                <>
                  {" "}
                  ·{" "}
                  <a
                    href={s.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    source
                  </a>
                </>
              ) : null}
            </li>
          ))}
          {!c?.sources?.length ? (
            <li>No external source — manual create</li>
          ) : null}
        </ul>
        <p className="text-[12px] text-black/40">
          Open Food Facts / Open Products Facts data is open-licensed; KlikCollect
          category and published values remain canonical after your review.
        </p>
      </section>

      {error ? <p className="text-[13px] text-red-700">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={adminUi.btnPrimary}
          disabled={busy}
          onClick={() => void commit()}
        >
          {busy ? "Creating…" : "Create KlikCollect Product"}
        </button>
        <button
          type="button"
          className={adminUi.btnSecondary}
          onClick={onScanAnother}
          disabled={busy}
        >
          Scan another
        </button>
      </div>
    </div>
  );
}

function LocalFoundCard({
  product,
  onScanAnother,
}: {
  product: LocalProductHit;
  onScanAnother: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-800">
        Product already exists
      </p>
      <div className="flex gap-4">
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image}
            alt=""
            className="h-24 w-24 object-contain border border-black/10 bg-white"
          />
        ) : null}
        <div>
          <h2 className="text-[20px] font-medium">{product.name}</h2>
          <p className="text-[13px] text-black/50">
            {[product.brand, product.barcode, product.status]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {product.categoryName ? (
            <p className="text-[13px] text-black/45">{product.categoryName}</p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/admin/products/${product.id}`}
          className={adminUi.btnPrimary}
        >
          View product
        </Link>
        <button
          type="button"
          className={adminUi.btnSecondary}
          onClick={onScanAnother}
        >
          Scan another
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  prov,
  children,
}: {
  label: string;
  required?: boolean;
  prov?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.14em] text-black/40">
        <span>
          {label}
          {required ? " *" : ""}
        </span>
        {prov ? <span className="normal-case tracking-normal">{prov}</span> : null}
      </span>
      {children}
    </label>
  );
}
