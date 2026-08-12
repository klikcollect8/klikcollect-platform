"use client";

import Link from "next/link";
import { adminUi } from "@/components/admin/admin-ui";
import NutritionBars from "@/components/admin/catalogue/viz/NutritionBars";
import ProviderConfidenceChart from "@/components/admin/catalogue/viz/ProviderConfidenceChart";
import ScoreRadar from "@/components/admin/catalogue/viz/ScoreRadar";
import type {
  CandidateField,
  CandidateProduct,
  LocalProductHit,
  ProviderLookupResult,
  SimilarProductHit,
} from "@/lib/product-resolver/types";
import { cn } from "@/lib/utils";

export type ProductDataVisualInput = {
  name?: string | null;
  brand?: string | null;
  barcode?: string | null;
  format?: string | null;
  image?: string | null;
  quantity?: string | null;
  statusLabel?: string | null;
  description?: string | null;
  localProduct?: LocalProductHit | null;
  candidate?: Partial<CandidateProduct> | null;
  providerResults?: ProviderLookupResult[];
  similarProducts?: SimilarProductHit[];
  showVariants?: boolean;
  /** Catalogue list / detail extras */
  sku?: string | null;
  productKind?: string | null;
  saleUnit?: string | null;
  guidePrice?: string | null;
  minOffer?: string | null;
  offerCount?: number | null;
  totalStock?: number | null;
  updatedAt?: string | null;
  productStatus?: string | null;
  categoryName?: string | null;
  attributes?: Record<string, string> | null;
  extraMeta?: Array<{ label: string; value: string }>;
};

type Props = {
  data: ProductDataVisualInput;
  onResolveBarcode?: (barcode: string) => void;
  onEnqueueVariant?: (hit: SimilarProductHit) => void;
  compact?: boolean;
};

function fieldVal<T>(f?: CandidateField<T> | null): T | null {
  if (!f || f.value == null) return null;
  return f.value;
}

function groupVariants(similar: SimilarProductHit[]) {
  const byQty = new Map<string, SimilarProductHit[]>();
  for (const s of similar) {
    const name = (s.name || "").toLowerCase();
    let bucket = "Other";
    if (/\b\d+\s?(ml|l|g|kg|cl)\b/i.test(name)) {
      const m = name.match(/\b\d+\s?(ml|l|g|kg|cl)\b/i);
      bucket = m ? m[0].toUpperCase() : "Sized";
    } else if (
      /vanilla|chocolate|strawberry|mango|lemon|orange|mint|coffee|original|classic/i.test(
        name,
      )
    ) {
      const m = name.match(
        /vanilla|chocolate|strawberry|mango|lemon|orange|mint|coffee|original|classic/i,
      );
      bucket = m ? `Flavour · ${m[0]}` : "Flavour";
    } else if (s.brand) {
      bucket = `Brand · ${s.brand}`;
    }
    const list = byQty.get(bucket) || [];
    list.push(s);
    byQty.set(bucket, list);
  }
  return [...byQty.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-[10px] uppercase tracking-[0.14em] text-black/35">
        {title}
      </h3>
      {children}
    </section>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-black/[0.05] py-1.5 text-[12px]">
      <span className="text-black/40">{label}</span>
      <span className="text-right font-medium text-black/80">{value}</span>
    </div>
  );
}

/** Visual product intelligence: meters, tables, provenance. */
export default function ProductDataVisual({
  data,
  onResolveBarcode,
  onEnqueueVariant,
  compact,
}: Props) {
  const c = data.candidate || null;
  const local = data.localProduct || null;
  const image =
    data.image ||
    local?.image ||
    c?.images?.[0]?.url ||
    null;
  const name =
    data.name || local?.name || fieldVal(c?.name) || "Unknown product";
  const brand = data.brand || local?.brand || fieldVal(c?.brand) || null;
  const quantity = data.quantity || fieldVal(c?.quantity);
  const barcode = data.barcode || local?.barcode || c?.barcode || null;
  const similar = data.similarProducts || [];
  const showVariants = Boolean(data.showVariants && similar.length);
  const groups = showVariants ? groupVariants(similar) : [];
  const specs = c?.specs || [];
  const providers = data.providerResults || [];

  const textBlocks: Array<{ label: string; value: string }> = [];
  const pushText = (label: string, v: string | null | undefined) => {
    if (v?.trim()) textBlocks.push({ label, value: v.trim() });
  };
  pushText("Generic name", fieldVal(c?.genericName) || undefined);
  pushText("Description", data.description || fieldVal(c?.description) || undefined);
  pushText("Ingredients", fieldVal(c?.ingredients) || undefined);
  pushText("Allergens", fieldVal(c?.allergens) || undefined);
  pushText("Traces", fieldVal(c?.traces) || undefined);
  pushText("Additives", fieldVal(c?.additives) || undefined);
  pushText("Packaging", fieldVal(c?.packaging) || undefined);
  pushText("Storage", fieldVal(c?.storage) || undefined);
  pushText("Origins", fieldVal(c?.origins) || undefined);
  pushText("Manufacturer", fieldVal(c?.manufacturer) || undefined);
  pushText("Serving", fieldVal(c?.servingSize) || undefined);

  return (
    <div className={cn("space-y-6", compact && "space-y-4")}>
      <div className="grid gap-4 sm:grid-cols-[100px_1fr]">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            className="mx-auto h-24 w-24 object-contain sm:mx-0"
          />
        ) : (
          <div className="mx-auto flex h-24 w-24 items-center justify-center bg-black/[0.04] text-[10px] uppercase tracking-[0.12em] text-black/30 sm:mx-0">
            No image
          </div>
        )}
        <div className="min-w-0 space-y-2">
          {data.statusLabel ? (
            <p className="text-[10px] uppercase tracking-[0.14em] text-black/35">
              {data.statusLabel}
            </p>
          ) : null}
          <h2 className="text-[18px] font-medium tracking-tight text-black">
            {name}
          </h2>
          <p className="text-[13px] text-black/50">
            {[brand, quantity].filter(Boolean).join(" · ") || "—"}
          </p>
          {barcode ? (
            <p className="font-mono text-[12px] text-black/40">
              {data.format ? `${String(data.format).replace(/_/g, "-")} · ` : ""}
              {barcode}
            </p>
          ) : null}
          {local ? (
            <Link
              href={`/admin/products/${local.id}`}
              className={cn(adminUi.btnPrimary, "inline-flex")}
            >
              Open product
            </Link>
          ) : null}
        </div>
      </div>

      {(data.sku ||
        data.productKind ||
        data.saleUnit ||
        data.guidePrice ||
        data.minOffer ||
        data.categoryName ||
        data.offerCount != null ||
        data.totalStock != null ||
        data.productStatus) && (
        <Section title="Catalogue">
          <div>
            {data.sku ? <MetaRow label="SKU" value={data.sku} /> : null}
            {data.categoryName ? (
              <MetaRow label="Category" value={data.categoryName} />
            ) : null}
            {brand ? <MetaRow label="Brand" value={brand} /> : null}
            {data.productKind ? (
              <MetaRow label="Type" value={data.productKind} />
            ) : null}
            {data.saleUnit ? (
              <MetaRow label="Sale unit" value={data.saleUnit} />
            ) : null}
            {data.guidePrice ? (
              <MetaRow label="Guide" value={data.guidePrice} />
            ) : null}
            {data.minOffer ? (
              <MetaRow label="Min offer" value={data.minOffer} />
            ) : null}
            {data.offerCount != null ? (
              <MetaRow label="Offers" value={String(data.offerCount)} />
            ) : null}
            {data.totalStock != null ? (
              <MetaRow label="Stock" value={String(data.totalStock)} />
            ) : null}
            {data.productStatus ? (
              <MetaRow label="Status" value={data.productStatus} />
            ) : null}
            {data.updatedAt ? (
              <MetaRow
                label="Updated"
                value={new Date(data.updatedAt).toLocaleString()}
              />
            ) : null}
          </div>
        </Section>
      )}

      {data.extraMeta && data.extraMeta.length > 0 ? (
        <Section title="Record">
          <div>
            {data.extraMeta.map((m) => (
              <MetaRow key={m.label} label={m.label} value={m.value} />
            ))}
          </div>
        </Section>
      ) : null}

      {data.attributes && Object.keys(data.attributes).length > 0 ? (
        <Section title="Attributes">
          <div>
            {Object.entries(data.attributes)
              .slice(0, 40)
              .map(([k, v]) => (
                <MetaRow key={k} label={k} value={String(v)} />
              ))}
          </div>
        </Section>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <ScoreRadar
          nutriscore={fieldVal(c?.nutriscore)}
          novaGroup={fieldVal(c?.novaGroup)}
          ecoscore={fieldVal(c?.ecoscore)}
          completeness={
            fieldVal(c?.completeness) != null
              ? Number(fieldVal(c?.completeness))
              : null
          }
        />
        <NutritionBars nutrition={fieldVal(c?.nutrition) || null} />
      </div>

      {(fieldVal(c?.vegan) ||
        fieldVal(c?.vegetarian) ||
        fieldVal(c?.palmOil)) && (
        <div className="flex flex-wrap gap-2 text-[11px] text-black/50">
          {fieldVal(c?.vegan) ? (
            <span className="border border-black/10 px-2 py-0.5">Vegan</span>
          ) : null}
          {fieldVal(c?.vegetarian) ? (
            <span className="border border-black/10 px-2 py-0.5">
              Vegetarian
            </span>
          ) : null}
          {fieldVal(c?.palmOil) ? (
            <span className="border border-black/10 px-2 py-0.5">
              Palm oil: {String(fieldVal(c?.palmOil))}
            </span>
          ) : null}
        </div>
      )}

      {specs.length > 0 ? (
        <Section title="Specs">
          <table className="w-full border-collapse text-left text-[12px]">
            <tbody>
              {specs.map((s) => (
                <tr key={s.key} className="border-b border-black/[0.05]">
                  <td className="py-1.5 pr-2 text-black/40">{s.key}</td>
                  <td className="py-1.5 font-medium">{s.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ) : null}

      {textBlocks.length ? (
        <Section title="Composition & packaging">
          <div className="space-y-3">
            {textBlocks.map((b) => (
              <div key={b.label}>
                <p className="text-[10px] uppercase tracking-[0.12em] text-black/35">
                  {b.label}
                </p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-black/65">
                  {b.value.length > 400 ? `${b.value.slice(0, 400)}…` : b.value}
                </p>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {(fieldVal(c?.labels)?.length ||
        fieldVal(c?.countries)?.length ||
        fieldVal(c?.stores)?.length ||
        fieldVal(c?.externalCategories)?.length) && (
        <Section title="Tags">
          <div className="space-y-1.5 text-[12px] text-black/60">
            {fieldVal(c?.externalCategories)?.length ? (
              <p>Categories: {fieldVal(c?.externalCategories)!.join(" · ")}</p>
            ) : null}
            {fieldVal(c?.labels)?.length ? (
              <p>Labels: {fieldVal(c?.labels)!.join(" · ")}</p>
            ) : null}
            {fieldVal(c?.countries)?.length ? (
              <p>Countries: {fieldVal(c?.countries)!.join(" · ")}</p>
            ) : null}
            {fieldVal(c?.stores)?.length ? (
              <p>Stores: {fieldVal(c?.stores)!.join(" · ")}</p>
            ) : null}
          </div>
        </Section>
      )}

      {providers.length ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <ProviderConfidenceChart providerResults={providers} />
          <Section title="Provenance">
            <table className="w-full border-collapse text-left text-[12px]">
              <thead>
                <tr className="border-b border-black/10 text-[10px] uppercase tracking-[0.12em] text-black/35">
                  <th className="py-1.5 pr-2 font-medium">Provider</th>
                  <th className="py-1.5 pr-2 font-medium">Status</th>
                  <th className="py-1.5 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((p, i) => (
                  <tr
                    key={`${p.provider}-${i}`}
                    className="border-b border-black/[0.05]"
                  >
                    <td className="py-1.5 pr-2">{p.provider}</td>
                    <td className="py-1.5 pr-2">{p.status}</td>
                    <td className="py-1.5 text-black/45">
                      {p.fromCache ? "cache · " : ""}
                      {p.message || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        </div>
      ) : null}

      {c?.sources?.length ? (
        <Section title="Sources">
          <ul className="divide-y divide-black/[0.05] text-[12px]">
            {c.sources.map((s, i) => (
              <li key={`${s.provider}-${i}`} className="py-2">
                <p className="font-medium">{s.provider}</p>
                <p className="font-mono text-[11px] text-black/40">
                  {s.externalProductId || "—"}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {showVariants ? (
        <Section title="Variants & related">
          {groups.map(([group, hits]) => (
            <div key={group} className="mb-3">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-black/40">
                {group}
                <span className="ml-2 font-normal tabular-nums text-black/30">
                  {hits.length}
                </span>
              </p>
              <ul className="divide-y divide-black/[0.05]">
                {hits.map((hit) => (
                  <li
                    key={hit.barcode}
                    className="flex items-center gap-2 py-1.5"
                  >
                    <div className="min-w-0 flex-1 truncate text-[12px]">
                      {hit.name || hit.barcode}
                    </div>
                    <button
                      type="button"
                      className={adminUi.btnGhost}
                      onClick={() => onResolveBarcode?.(hit.barcode)}
                    >
                      View
                    </button>
                    {onEnqueueVariant && !hit.inCatalogue ? (
                      <button
                        type="button"
                        className={adminUi.btnGhost}
                        onClick={() => onEnqueueVariant(hit)}
                      >
                        Queue
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Section>
      ) : null}

      {!showVariants && similar.length > 0 ? (
        <Section title="Similar">
          <ul className="divide-y divide-black/[0.05]">
            {similar.slice(0, 8).map((hit) => (
              <li
                key={hit.barcode}
                className="flex items-center gap-2 py-1.5 text-[12px]"
              >
                <span className="min-w-0 flex-1 truncate">
                  {hit.name || hit.barcode}
                </span>
                <button
                  type="button"
                  className={adminUi.btnGhost}
                  onClick={() => onResolveBarcode?.(hit.barcode)}
                >
                  View
                </button>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {c?.rawSnapshot ? (
        <details>
          <summary className="cursor-pointer text-[11px] text-black/40 hover:text-black">
            Raw snapshot
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto bg-black/[0.03] p-2 text-[10px] text-black/55">
            {JSON.stringify(c.rawSnapshot, null, 2)}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

