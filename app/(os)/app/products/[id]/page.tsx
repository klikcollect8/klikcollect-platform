"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { osUi } from "@/components/os/os-ui";
import { StatusBadge } from "@/components/os/StatusBadge";
import { cn } from "@/lib/utils";
import { formatKesMajor } from "@/lib/money";

type OfferRow = {
  id: string;
  name: string;
  description?: string;
  category?: string;
  image?: string;
  price: number;
  stock: number;
  barcode?: string;
  vendorId?: string;
  status?: string;
  guidePriceMin?: number | null;
  guidePriceAvg?: number | null;
  guidePriceMax?: number | null;
  saleUnit?: string | null;
};

type CorrectionRow = {
  public_id: string;
  product_public_id: string;
  offer_public_id?: string | null;
  message: string;
  fields?: Record<string, string> | null;
  status: string;
  created_at: string;
};

const FIELD_KEYS = [
  { id: "name", label: "Name" },
  { id: "image", label: "Image" },
  { id: "category", label: "Category" },
  { id: "specs", label: "Specs" },
  { id: "barcode", label: "Barcode" },
] as const;

export default function VendorOfferDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id || "");
  const [product, setProduct] = useState<OfferRow | null>(null);
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [correction, setCorrection] = useState("");
  const [fieldChecks, setFieldChecks] = useState<Record<string, boolean>>({
    name: false,
    image: false,
    category: false,
    specs: false,
    barcode: false,
  });
  const [priorRequests, setPriorRequests] = useState<CorrectionRow[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadOffer = () => {
    if (!id) return;
    void fetch("/api/os/offers")
      .then((r) => r.json())
      .then((body) => {
        const p = (body?.data || []).find((x: OfferRow) => x.id === id);
        if (p) {
          setProduct(p);
          setPrice(String(Math.round(p.price)));
          setStock(String(p.stock ?? 0));
        }
      });
  };

  const loadCorrections = () => {
    void fetch("/api/os/catalogue-corrections")
      .then((r) => r.json())
      .then((body) => {
        const rows = (body?.data || []) as CorrectionRow[];
        setPriorRequests(
          rows.filter(
            (r) =>
              r.offer_public_id === id ||
              (product?.id && r.product_public_id === product.id),
          ),
        );
      })
      .catch(() => setPriorRequests([]));
  };

  useEffect(() => {
    loadOffer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!id) return;
    loadCorrections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, product?.id]);

  const savePrice = async () => {
    setBusy(true);
    setStatus(null);
    const res = await fetch(`/api/os/offers/${encodeURIComponent(id)}/price`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceMajor: Number(price) }),
    });
    setBusy(false);
    setStatus(
      res.ok
        ? "Price saved — fee quotes use your new offer."
        : "Could not save price",
    );
    if (res.ok) {
      loadOffer();
      router.refresh();
    }
  };

  const saveStock = async () => {
    setBusy(true);
    setStatus(null);
    const res = await fetch(`/api/os/offers/${encodeURIComponent(id)}/stock`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onHand: Number(stock), reason: "offer_detail" }),
    });
    setBusy(false);
    setStatus(res.ok ? "Stock updated." : "Could not update stock");
    if (res.ok) {
      loadOffer();
      router.refresh();
    }
  };

  const toggleAvailability = async () => {
    if (!product) return;
    const next = product.status === "draft" ? "published" : "draft";
    setBusy(true);
    setStatus(null);
    const res = await fetch(
      `/api/os/offers/${encodeURIComponent(id)}/availability`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      },
    );
    setBusy(false);
    setStatus(
      res.ok
        ? next === "draft"
          ? "Offer paused — hidden from shoppers."
          : "Offer resumed — selling again."
        : "Could not update availability",
    );
    if (res.ok) {
      loadOffer();
      router.refresh();
    }
  };

  const requestCorrection = async () => {
    if (correction.trim().length < 5) {
      setStatus("Describe what needs fixing (at least 5 characters).");
      return;
    }
    const selected = FIELD_KEYS.filter((f) => fieldChecks[f.id]).map(
      (f) => f.id,
    );
    if (!selected.length) {
      setStatus("Select at least one field that needs correcting.");
      return;
    }
    const fields: Record<string, string> = {};
    for (const key of selected) fields[key] = "needs_correction";

    setBusy(true);
    setStatus(null);
    const res = await fetch("/api/os/catalogue-corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offerId: id,
        message: correction.trim(),
        fields,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setStatus(json.error?.message || "Could not send correction request");
      return;
    }
    setStatus(
      "Correction sent to KlikCollect. Product details stay read-only until they update the catalogue.",
    );
    setCorrection("");
    setFieldChecks({
      name: false,
      image: false,
      category: false,
      specs: false,
      barcode: false,
    });
    loadCorrections();
  };

  if (!product) {
    return (
      <div className="p-6">
        <p className="text-[14px] text-[var(--kc-mute)]">Loading offer…</p>
        <Link
          href="/app/products"
          className="mt-4 inline-block text-[13px] underline"
        >
          Back to products
        </Link>
      </div>
    );
  }

  const selling = product.status !== "draft";

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-4 sm:p-6">
      <div>
        <Link
          href="/app/products"
          className="text-[13px] text-[var(--kc-mute)] underline"
        >
          ← My products
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-[clamp(1.4rem,3vw,1.85rem)] font-semibold tracking-tight">
            {product.name}
          </h1>
          <StatusBadge status={selling ? "published" : "draft"} />
        </div>
        <p className="mt-2 text-[14px] text-[var(--kc-mute)]">
          Catalogue details are owned by KlikCollect. You control your price,
          stock, and whether this offer is selling.
        </p>
      </div>

      <div className="flex gap-4 rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-white p-4">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded bg-[var(--kc-canvas)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              product.image ||
              "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200"
            }
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0 text-[13px] text-[var(--kc-mute)]">
          <p>
            <span className="text-[var(--kc-faint)]">Category</span> ·{" "}
            {product.category || "—"}
          </p>
          <p className="mt-1">
            <span className="text-[var(--kc-faint)]">Barcode</span> ·{" "}
            {product.barcode || "—"}
          </p>
          {product.guidePriceAvg != null ? (
            <p className="mt-1">
              <span className="text-[var(--kc-faint)]">Platform guide</span> ·{" "}
              {formatKesMajor(product.guidePriceMin ?? 0)} –{" "}
              {formatKesMajor(product.guidePriceAvg)} –{" "}
              {formatKesMajor(product.guidePriceMax ?? 0)}
              {product.saleUnit ? ` / ${product.saleUnit}` : ""}
            </p>
          ) : null}
          <p className="mt-2 line-clamp-3">
            {product.description || "No description"}
          </p>
        </div>
      </div>

      <section className="space-y-4 rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={osUi.sectionLabel}>Your offer</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void toggleAvailability()}
            className={cn(osUi.btnSecondary, "disabled:opacity-40")}
          >
            {selling ? "Pause selling" : "Resume selling"}
          </button>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-[12px] text-[var(--kc-mute)]">
            Selling price (KES)
          </span>
          <input
            className={osUi.input}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="numeric"
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void savePrice()}
          className={cn(osUi.btnPrimary, "disabled:opacity-40")}
        >
          Save price
        </button>
        <label className="block pt-2">
          <span className="mb-1.5 block text-[12px] text-[var(--kc-mute)]">
            On-hand stock
          </span>
          <input
            className={osUi.input}
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            inputMode="numeric"
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void saveStock()}
          className={cn(osUi.btnSecondary, "disabled:opacity-40")}
        >
          Save stock
        </button>
        <p className="text-[12px] text-[var(--kc-faint)]">
          Current: {formatKesMajor(product.price)} · {product.stock} units ·{" "}
          {selling ? "Selling" : "Paused"}
        </p>
      </section>

      <section className="space-y-3 rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-white p-4">
        <p className={osUi.sectionLabel}>Request catalogue correction</p>
        <p className="text-[13px] text-[var(--kc-mute)]">
          Wrong name, image, or specs? Tell KlikCollect — you cannot edit the
          product record yourself.
        </p>
        <div className="flex flex-wrap gap-3">
          {FIELD_KEYS.map((f) => (
            <label
              key={f.id}
              className="flex items-center gap-2 text-[13px] text-[var(--kc-ink)]"
            >
              <input
                type="checkbox"
                checked={!!fieldChecks[f.id]}
                onChange={(e) =>
                  setFieldChecks((prev) => ({
                    ...prev,
                    [f.id]: e.target.checked,
                  }))
                }
              />
              {f.label}
            </label>
          ))}
        </div>
        <textarea
          className={cn(osUi.input, "min-h-[100px]")}
          value={correction}
          onChange={(e) => setCorrection(e.target.value)}
          placeholder="e.g. Image shows wrong colour variant"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void requestCorrection()}
          className={cn(osUi.btnSecondary, "disabled:opacity-40")}
        >
          Send to KlikCollect
        </button>

        {priorRequests.length ? (
          <div className="border-t border-[var(--kc-line-soft)] pt-4">
            <p className="text-[12px] font-medium text-[var(--kc-faint)]">
              Your prior requests
            </p>
            <ul className="mt-2 space-y-2">
              {priorRequests.slice(0, 8).map((r) => (
                <li
                  key={r.public_id}
                  className="rounded border border-[var(--kc-line-soft)] px-3 py-2 text-[12px]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <StatusBadge status={r.status} />
                    <span className="text-[var(--kc-faint)]">
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-1 text-[var(--kc-mute)]">{r.message}</p>
                  {r.fields && Object.keys(r.fields).length ? (
                    <p className="mt-1 text-[11px] text-[var(--kc-faint)]">
                      Fields: {Object.keys(r.fields).join(", ")}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {status ? (
        <p className="text-[13px] text-[var(--kc-mute)]">{status}</p>
      ) : null}
    </div>
  );
}
