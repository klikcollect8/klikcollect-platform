"use client";

import { useEffect, useMemo, useState } from "react";
import { formatKesMajor } from "@/lib/money";
import { OsFilterRail } from "@/components/os/OsFilterRail";
import { OsListRow } from "@/components/os/OsListRow";
import { OsEmptyState } from "@/components/os/OsEmptyState";
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

function stockMeta(p: ProductRow): string {
  const stock = typeof p.stock === "number" ? p.stock : null;
  const price = formatKesMajor(p.price);
  if (stock === null) return price;
  if (stock <= 0) return `${price} · Out of stock`;
  if (stock <= 5) return `${price} · ${stock} left`;
  return `${price} · ${stock} in stock`;
}

function stockStatus(p: ProductRow): string | undefined {
  const stock = typeof p.stock === "number" ? p.stock : null;
  if (p.status === "draft") return "draft";
  if (stock === 0) return "out";
  if (stock !== null && stock <= 5) return "low";
  if (!p.status || p.status === "published") return "published";
  return p.status;
}

export function ProductsTable({
  products,
  vendors,
  offerMode = false,
}: {
  products: ProductRow[];
  vendors?: Record<string, string>;
  /** Vendor workspace: list → detail for price/stock edits */
  offerMode?: boolean;
}) {
  const [rows, setRows] = useState(products);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all");
  const [q, setQ] = useState("");

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

  return (
    <div className="space-y-5">
      <OsFilterRail
        options={TABS.map((t) => ({
          id: t.id,
          label: t.label,
          count: byTab(t.id, rows).length,
        }))}
        value={tab}
        onChange={(id) => setTab(id as (typeof TABS)[number]["id"])}
      />

      <label className="block">
        <span className="sr-only">Search products</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or barcode…"
          className="w-full border-b border-black/15 bg-transparent py-3 text-[15px] text-black outline-none placeholder:text-black/35 focus:border-black/50"
        />
      </label>

      {!filtered.length ? (
        <OsEmptyState
          title="No products match this view"
          body="Assigned catalogue items will appear here. Update price and stock from each product screen."
          actionLabel="Open stock"
          actionHref="/app/inventory"
        />
      ) : (
        <div className="border-t border-black/10">
          {filtered.map((p) => {
            const status = stockStatus(p);
            const metaParts = [
              stockMeta(p),
              p.category || null,
              !offerMode && p.vendorId
                ? vendors?.[p.vendorId] || null
                : null,
            ].filter(Boolean);

            return (
              <OsListRow
                key={p.id}
                href={`/app/products/${encodeURIComponent(p.id)}`}
                title={p.name}
                meta={metaParts.join(" · ")}
                status={status}
                statusLabel={
                  status === "published"
                    ? "Selling"
                    : status === "draft"
                      ? "Paused"
                      : status === "out"
                        ? "Out"
                        : status === "low"
                          ? "Low"
                          : status
                }
                leading={
                  <div className="h-12 w-12 shrink-0 overflow-hidden bg-black/[0.04]">
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
                }
              />
            );
          })}
        </div>
      )}

      {filtered.length ? (
        <p className={cn("text-[12px] text-black/35")}>
          {filtered.length} products · catalogue owned by KlikCollect
          {offerMode ? " · tap to edit price & stock" : ""}
        </p>
      ) : null}
    </div>
  );
}
