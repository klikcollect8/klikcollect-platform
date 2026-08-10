"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { formatKesMajor } from "@/lib/money";
import { StatusBadge } from "@/components/os/StatusBadge";
import { cn } from "@/lib/utils";

export type ProductRow = {
  id: string;
  name: string;
  price: number;
  category?: string;
  image?: string;
  stock?: number;
  status?: string;
  vendorId?: string;
  barcode?: string;
  guidePriceMin?: number | null;
  guidePriceAvg?: number | null;
  guidePriceMax?: number | null;
  saleUnit?: string | null;
};

const TABS = [
  { id: "all", label: "All" },
  { id: "published", label: "Selling" },
  { id: "low", label: "Low stock" },
  { id: "out", label: "Out of stock" },
] as const;

export function ProductsTable({
  products,
  vendors,
  offerMode = false,
}: {
  products: ProductRow[];
  vendors?: Record<string, string>;
  /** Vendor workspace: no catalogue publish/archive bulk actions */
  offerMode?: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(products);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all");
  const [q, setQ] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState("");
  const [stockDraft, setStockDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    setRows(products);
  }, [products]);

  function byTab(id: (typeof TABS)[number]["id"], list: ProductRow[]) {
    if (id === "published")
      return list.filter((p) => !p.status || p.status === "published");
    if (id === "low")
      return list.filter(
        (p) =>
          typeof p.stock === "number" &&
          p.stock > 0 &&
          p.stock <= 5 &&
          p.status !== "archived",
      );
    if (id === "out")
      return list.filter((p) => typeof p.stock === "number" && p.stock <= 0);
    return list;
  }

  const filtered = useMemo(() => {
    let list = byTab(tab, rows);
    if (q.trim()) {
      const needle = q.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          (p.category || "").toLowerCase().includes(needle) ||
          (p.barcode || "").toLowerCase().includes(needle),
      );
    }
    return list;
  }, [rows, tab, q]);

  async function readError(res: Response) {
    const json = await res.json().catch(() => ({}));
    return json?.error?.message || `Request failed (${res.status})`;
  }

  async function savePrice(id: string) {
    const priceMajor = Number(priceDraft);
    if (!Number.isInteger(priceMajor) || priceMajor < 0) {
      setStatusMsg("Price must be a whole KES amount ≥ 0");
      return;
    }
    setBusy(true);
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/os/offers/${encodeURIComponent(id)}/price`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceMajor }),
      });
      if (!res.ok) {
        setStatusMsg(await readError(res));
        return;
      }
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, price: priceMajor } : r)),
      );
      setEditingId(null);
      setStatusMsg("Price saved");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function saveStock(id: string) {
    const onHand = Number(stockDraft);
    if (!Number.isInteger(onHand) || onHand < 0) {
      setStatusMsg("Stock must be a whole number ≥ 0");
      return;
    }
    setBusy(true);
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/os/offers/${encodeURIComponent(id)}/stock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onHand, reason: "quick_edit" }),
      });
      if (!res.ok) {
        setStatusMsg(await readError(res));
        return;
      }
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, stock: onHand } : r)),
      );
      setEditingId(null);
      setStatusMsg("Stock saved");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggleAvailability(id: string, status?: string) {
    const next = status === "draft" ? "published" : "draft";
    setBusy(true);
    setStatusMsg(null);
    try {
      const res = await fetch(
        `/api/os/offers/${encodeURIComponent(id)}/availability`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        },
      );
      if (!res.ok) {
        setStatusMsg(await readError(res));
        return;
      }
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: next } : r)),
      );
      setStatusMsg(next === "draft" ? "Offer paused" : "Offer resumed");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-white">
      <div className="flex flex-col gap-3 border-b border-[var(--kc-line-soft)] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-[var(--kc-radius-sm)] px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                tab === t.id
                  ? "bg-[var(--kc-canvas)] text-[var(--kc-ink)]"
                  : "text-[var(--kc-mute)] hover:bg-[var(--kc-canvas)]/60",
              )}
            >
              {t.label}
              <span className="ml-1 text-[var(--kc-faint)]">
                {byTab(t.id, rows).length}
              </span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--kc-faint)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or barcode"
            className="w-full rounded-[var(--kc-radius-sm)] border border-[var(--kc-line)] py-1.5 pl-8 pr-3 text-[13px] outline-none focus:border-[var(--kc-ink)] sm:w-56"
          />
        </div>
      </div>

      {statusMsg ? (
        <p className="border-b border-[var(--kc-line-soft)] px-4 py-2 text-[12px] text-[var(--kc-mute)]">
          {statusMsg}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead className="border-b border-[var(--kc-line-soft)] text-[12px] text-[var(--kc-faint)]">
            <tr>
              <th className="px-4 py-2.5 font-medium">Product</th>
              <th className="px-4 py-2.5 font-medium">Category</th>
              <th className="px-4 py-2.5 font-medium">Your stock</th>
              <th className="px-4 py-2.5 text-right font-medium">Your price</th>
              {offerMode ? (
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              ) : (
                <th className="px-4 py-2.5 font-medium">Vendor</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--kc-line-soft)]">
            {filtered.map((p) => {
              const stock = typeof p.stock === "number" ? p.stock : null;
              const editing = editingId === p.id;
              return (
                <tr key={p.id} className="hover:bg-[var(--kc-canvas)]">
                  <td className="px-4 py-3">
                    <Link
                      href={`/app/products/${p.id}`}
                      className="flex items-center gap-3"
                    >
                      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-[var(--kc-radius-sm)] bg-[var(--kc-canvas)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={
                            p.image ||
                            "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200"
                          }
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-[var(--kc-ink)] hover:underline">
                          {p.name}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          {p.barcode ? (
                            <span className="text-[11px] text-[var(--kc-faint)]">
                              {p.barcode}
                            </span>
                          ) : null}
                          {offerMode && p.status === "draft" ? (
                            <StatusBadge status="draft" />
                          ) : null}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--kc-mute)]">
                    {p.category || "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--kc-mute)]">
                    {editing && offerMode ? (
                      <input
                        value={stockDraft}
                        onChange={(e) => setStockDraft(e.target.value)}
                        className="w-20 rounded border border-[var(--kc-line)] px-2 py-1 text-[13px]"
                        inputMode="numeric"
                      />
                    ) : stock === null ? (
                      "—"
                    ) : stock === 0 ? (
                      <span className="text-[#8e1b0d]">Out of stock</span>
                    ) : (
                      <span className={stock <= 5 ? "text-[#8a6116]" : ""}>
                        {stock} in stock
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-[var(--kc-ink)]">
                    {editing && offerMode ? (
                      <input
                        value={priceDraft}
                        onChange={(e) => setPriceDraft(e.target.value)}
                        className="ml-auto w-24 rounded border border-[var(--kc-line)] px-2 py-1 text-right text-[13px]"
                        inputMode="numeric"
                      />
                    ) : (
                      <div className="text-right">
                        <p>{formatKesMajor(p.price)}</p>
                        {p.guidePriceAvg != null ? (
                          <p className="text-[11px] font-normal text-[var(--kc-faint)]">
                            Guide {formatKesMajor(p.guidePriceAvg)}
                          </p>
                        ) : null}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {offerMode ? (
                      editing ? (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void savePrice(p.id)}
                            className="text-[12px] font-medium text-[var(--kc-ink)] underline disabled:opacity-40"
                          >
                            Save price
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void saveStock(p.id)}
                            className="text-[12px] font-medium text-[var(--kc-ink)] underline disabled:opacity-40"
                          >
                            Save stock
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(null);
                              setStatusMsg(null);
                            }}
                            className="text-[12px] text-[var(--kc-mute)]"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void toggleAvailability(p.id, p.status)
                            }
                            className="text-[12px] font-medium text-[var(--kc-ink)] underline disabled:opacity-40"
                          >
                            {p.status === "draft" ? "Resume" : "Pause"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(p.id);
                              setPriceDraft(String(Math.round(p.price)));
                              setStockDraft(String(p.stock ?? 0));
                              setStatusMsg(null);
                            }}
                            className="text-[12px] font-medium text-[var(--kc-ink)] underline"
                          >
                            Update
                          </button>
                        </div>
                      )
                    ) : (
                      <span className="text-[var(--kc-mute)]">
                        {(p.vendorId && vendors?.[p.vendorId]) || "—"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!filtered.length ? (
        <p className="px-4 py-12 text-center text-[13px] text-[var(--kc-faint)]">
          No assigned products match this view
        </p>
      ) : (
        <div className="border-t border-[var(--kc-line-soft)] px-4 py-2.5 text-[12px] text-[var(--kc-faint)]">
          {filtered.length} products · catalogue owned by KlikCollect
        </div>
      )}
    </div>
  );
}
