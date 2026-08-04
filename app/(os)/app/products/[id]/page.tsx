"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { osUi } from "@/components/os/os-ui";
import { cn } from "@/lib/utils";

type VariantDraft = {
  title: string;
  sku: string;
  barcode: string;
  options: string;
  priceKes: string;
  saleKes: string;
  compareKes: string;
  wholesaleKes: string;
  onHand: string;
  vatClass: string;
};

function emptyVariant(): VariantDraft {
  return {
    title: "Default",
    sku: "",
    barcode: "",
    options: "",
    priceKes: "",
    saleKes: "",
    compareKes: "",
    wholesaleKes: "",
    onHand: "0",
    vatClass: "standard",
  };
}

export default function ProductEditPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const [product, setProduct] = useState<{
    id: string;
    name: string;
    price: number;
    stock: number;
    vendorId?: string;
  } | null>(null);
  const [variants, setVariants] = useState<VariantDraft[]>([emptyVariant()]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch("/api/products/catalogue").then((r) => r.json()),
      fetch(
        `/api/os/products/variants?productId=${encodeURIComponent(id)}`,
      ).then((r) => r.json()),
    ]).then(([cat, vars]) => {
      const p = (cat?.data || []).find((x: { id: string }) => x.id === id);
      setProduct(p || null);
      const rows = vars?.data || [];
      if (rows.length) {
        setVariants(
          rows.map(
            (v: {
              title?: string;
              sku?: string;
              barcode?: string;
              options?: Record<string, string>;
              price_minor?: number;
              sale_price_minor?: number;
              compare_at_minor?: number;
              wholesale_price_minor?: number;
              on_hand?: number;
              vat_class?: string;
            }) => ({
              title: v.title || "Default",
              sku: v.sku || "",
              barcode: v.barcode || "",
              options: v.options
                ? Object.entries(v.options)
                    .map(([k, val]) => `${k}:${val}`)
                    .join(", ")
                : "",
              priceKes: String(Math.round(Number(v.price_minor || 0) / 100)),
              saleKes:
                v.sale_price_minor != null
                  ? String(Math.round(Number(v.sale_price_minor) / 100))
                  : "",
              compareKes:
                v.compare_at_minor != null
                  ? String(Math.round(Number(v.compare_at_minor) / 100))
                  : "",
              wholesaleKes:
                v.wholesale_price_minor != null
                  ? String(Math.round(Number(v.wholesale_price_minor) / 100))
                  : "",
              onHand: String(v.on_hand ?? 0),
              vatClass: v.vat_class || "standard",
            }),
          ),
        );
      } else if (p) {
        setVariants([
          {
            ...emptyVariant(),
            title: "Default",
            priceKes: String(p.price || 0),
            onHand: String(p.stock || 0),
          },
        ]);
      }
    });
  }, [id]);

  async function save() {
    if (!product) return;
    setBusy(true);
    setStatus(null);
    const payload = {
      productId: product.id,
      variants: variants.map((v) => {
        const options: Record<string, string> = {};
        for (const part of v.options.split(",")) {
          const [k, val] = part.split(":").map((s) => s.trim());
          if (k && val) options[k] = val;
        }
        return {
          title: v.title,
          sku: v.sku,
          barcode: v.barcode,
          options,
          priceMinor: Math.round(Number(v.priceKes || 0) * 100),
          salePriceMinor: v.saleKes
            ? Math.round(Number(v.saleKes) * 100)
            : null,
          compareAtMinor: v.compareKes
            ? Math.round(Number(v.compareKes) * 100)
            : null,
          wholesalePriceMinor: v.wholesaleKes
            ? Math.round(Number(v.wholesaleKes) * 100)
            : null,
          onHand: Number(v.onHand || 0),
          vatClass: v.vatClass,
        };
      }),
    };
    const res = await fetch("/api/os/products/variants", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    setBusy(false);
    setStatus(
      res.ok
        ? `Saved ${body?.data?.length || 0} variants`
        : body?.error?.message || "Save failed",
    );
  }

  if (!product) {
    return (
      <div className="w-full">
        <p className={osUi.pageEyebrow}>Products</p>
        <h1 className={cn("mt-2", osUi.pageTitle)}>Loading…</h1>
      </div>
    );
  }

  const base = Number(variants[0]?.priceKes || product.price || 0);
  const commissionEst = Math.round(base * 0.15);

  return (
    <div className="w-full space-y-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={osUi.pageEyebrow}>Products</p>
          <h1
            className={cn("mt-2", osUi.pageTitle)}
            style={{ fontFamily: "var(--font-display), sans-serif" }}
          >
            {product.name}
          </h1>
          <p className={cn("mt-2", osUi.pageDesc)}>
            Variants, base / sale / compare / wholesale pricing.
          </p>
        </div>
        <Link href="/app/products" className={osUi.btnGhost}>
          Back to list
        </Link>
      </div>

      <div className="border-t border-black/10 pt-4 text-[13px] text-black/45">
        Payout preview (est.): customer pays KES {base} · platform fee ~KES{" "}
        {commissionEst} · you ~KES {base - commissionEst}
      </div>

      {status ? <p className="text-[14px] text-black/50">{status}</p> : null}

      <div className="space-y-8">
        {variants.map((v, idx) => (
          <div
            key={idx}
            className="grid gap-4 border-t border-black/10 pt-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            <label className="block sm:col-span-2 lg:col-span-3">
              <span className={osUi.sectionLabel}>Variant title</span>
              <input
                className={cn("mt-1", osUi.input)}
                value={v.title}
                onChange={(e) =>
                  setVariants((prev) =>
                    prev.map((x, i) =>
                      i === idx ? { ...x, title: e.target.value } : x,
                    ),
                  )
                }
              />
            </label>
            <label className="block">
              <span className={osUi.sectionLabel}>
                Options (Size:M, Colour:Red)
              </span>
              <input
                className={cn("mt-1", osUi.input)}
                value={v.options}
                onChange={(e) =>
                  setVariants((prev) =>
                    prev.map((x, i) =>
                      i === idx ? { ...x, options: e.target.value } : x,
                    ),
                  )
                }
              />
            </label>
            <label className="block">
              <span className={osUi.sectionLabel}>SKU</span>
              <input
                className={cn("mt-1", osUi.input)}
                value={v.sku}
                onChange={(e) =>
                  setVariants((prev) =>
                    prev.map((x, i) =>
                      i === idx ? { ...x, sku: e.target.value } : x,
                    ),
                  )
                }
              />
            </label>
            <label className="block">
              <span className={osUi.sectionLabel}>Barcode</span>
              <input
                className={cn("mt-1", osUi.input)}
                value={v.barcode}
                onChange={(e) =>
                  setVariants((prev) =>
                    prev.map((x, i) =>
                      i === idx ? { ...x, barcode: e.target.value } : x,
                    ),
                  )
                }
              />
            </label>
            {(
              [
                ["priceKes", "Base price (KES)"],
                ["saleKes", "Sale price"],
                ["compareKes", "Compare at"],
                ["wholesaleKes", "Wholesale"],
                ["onHand", "On hand"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block">
                <span className={osUi.sectionLabel}>{label}</span>
                <input
                  type="number"
                  className={cn("mt-1", osUi.input)}
                  value={v[key]}
                  onChange={(e) =>
                    setVariants((prev) =>
                      prev.map((x, i) =>
                        i === idx ? { ...x, [key]: e.target.value } : x,
                      ),
                    )
                  }
                />
              </label>
            ))}
            <label className="block">
              <span className={osUi.sectionLabel}>VAT class</span>
              <select
                className={cn("mt-1", osUi.input)}
                value={v.vatClass}
                onChange={(e) =>
                  setVariants((prev) =>
                    prev.map((x, i) =>
                      i === idx ? { ...x, vatClass: e.target.value } : x,
                    ),
                  )
                }
              >
                <option value="standard">Standard</option>
                <option value="zero">Zero-rated</option>
                <option value="exempt">Exempt</option>
              </select>
            </label>
            {variants.length > 1 ? (
              <button
                type="button"
                className={osUi.btnGhost}
                onClick={() =>
                  setVariants((prev) => prev.filter((_, i) => i !== idx))
                }
              >
                Remove variant
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={osUi.btnSecondary}
          onClick={() => setVariants((prev) => [...prev, emptyVariant()])}
        >
          Add variant
        </button>
        <button
          type="button"
          disabled={busy}
          className={osUi.btnPrimary}
          onClick={save}
        >
          Save variants
        </button>
      </div>
    </div>
  );
}
