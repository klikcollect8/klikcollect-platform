"use client";

import { useMemo, useState } from "react";
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
};

const TABS = [
  { id: "all", label: "All" },
  { id: "published", label: "Active" },
  { id: "draft", label: "Draft" },
  { id: "archived", label: "Archived" },
  { id: "low", label: "Low stock" },
] as const;

export function ProductsTable({
  products,
  vendors,
}: {
  products: ProductRow[];
  vendors?: Record<string, string>;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  function byTab(id: (typeof TABS)[number]["id"], rows: ProductRow[]) {
    if (id === "published")
      return rows.filter((p) => !p.status || p.status === "published");
    if (id === "draft")
      return rows.filter(
        (p) => p.status === "draft" || p.status === "pending_review",
      );
    if (id === "archived") return rows.filter((p) => p.status === "archived");
    if (id === "low")
      return rows.filter(
        (p) =>
          typeof p.stock === "number" &&
          p.stock <= 5 &&
          p.status !== "archived",
      );
    return rows;
  }

  const filtered = useMemo(() => {
    let rows = byTab(tab, products);
    if (q.trim()) {
      const needle = q.toLowerCase();
      rows = rows.filter(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          (p.category || "").toLowerCase().includes(needle) ||
          ((p.vendorId && vendors?.[p.vendorId]) || "")
            .toLowerCase()
            .includes(needle),
      );
    }
    return rows;
  }, [products, tab, q, vendors]);

  const allSelected =
    filtered.length > 0 && filtered.every((p) => selected.has(p.id));

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(filtered.map((p) => p.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkStatus(status: "published" | "draft" | "archived") {
    if (!selected.size) return;
    setBusy(true);
    try {
      const res = await fetch("/api/products/catalogue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected], status }),
      });
      if (res.ok) {
        setSelected(new Set());
        router.refresh();
      }
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
                {byTab(t.id, products).length}
              </span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--kc-faint)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter products"
            className="w-full rounded-[var(--kc-radius-sm)] border border-[var(--kc-line)] py-1.5 pl-8 pr-3 text-[13px] outline-none focus:border-[var(--kc-ink)] sm:w-56"
          />
        </div>
      </div>

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--kc-line-soft)] bg-[var(--kc-canvas)] px-4 py-2.5">
          <span className="text-[12px] font-medium text-[var(--kc-ink)]">
            {selected.size} selected
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => bulkStatus("published")}
            className="rounded-[var(--kc-radius-sm)] bg-[var(--kc-ink)] px-2.5 py-1 text-[12px] font-medium text-white disabled:opacity-50"
          >
            Publish
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => bulkStatus("draft")}
            className="rounded-[var(--kc-radius-sm)] border border-[var(--kc-line)] bg-white px-2.5 py-1 text-[12px] font-medium text-[var(--kc-ink)] disabled:opacity-50"
          >
            Draft
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => bulkStatus("archived")}
            className="rounded-[var(--kc-radius-sm)] border border-[var(--kc-line)] bg-white px-2.5 py-1 text-[12px] font-medium text-[#8e1b0d] disabled:opacity-50"
          >
            Archive
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => bulkStatus("published")}
            className="rounded-[var(--kc-radius-sm)] border border-[var(--kc-line)] bg-white px-2.5 py-1 text-[12px] font-medium text-[var(--kc-ink)] disabled:opacity-50"
          >
            Restore
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead className="border-b border-[var(--kc-line-soft)] text-[12px] text-[var(--kc-faint)]">
            <tr>
              <th className="w-10 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all"
                />
              </th>
              <th className="px-4 py-2.5 font-medium">Product</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Inventory</th>
              <th className="px-4 py-2.5 font-medium">Category</th>
              <th className="px-4 py-2.5 font-medium">Vendor</th>
              <th className="px-4 py-2.5 text-right font-medium">Price</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--kc-line-soft)]">
            {filtered.map((p) => {
              const stock = typeof p.stock === "number" ? p.stock : null;
              const statusLabel =
                !p.status || p.status === "published"
                  ? "Active"
                  : p.status === "archived"
                    ? "Archived"
                    : p.status || "Draft";
              const badgeStatus =
                statusLabel === "Active"
                  ? "active"
                  : statusLabel === "Archived"
                    ? "cancelled"
                    : "draft";
              return (
                <tr key={p.id} className="hover:bg-[var(--kc-canvas)]">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggleOne(p.id)}
                      aria-label={`Select ${p.name}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/app/products/${p.id}`}
                        className="flex min-w-0 flex-1 items-center gap-3"
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
                        <span className="truncate font-medium text-[var(--kc-ink)] hover:underline">
                          {p.name}
                        </span>
                      </Link>
                      <Link
                        href={`/products/${p.id}`}
                        className="shrink-0 text-[11px] text-[var(--kc-faint)] hover:text-[var(--kc-ink)] hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Storefront
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={badgeStatus} label={statusLabel} />
                  </td>
                  <td className="px-4 py-3 text-[var(--kc-mute)]">
                    {stock === null ? (
                      " - "
                    ) : stock === 0 ? (
                      <span className="text-[#8e1b0d]">Out of stock</span>
                    ) : (
                      <span className={stock <= 5 ? "text-[#8a6116]" : ""}>
                        {stock} in stock
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--kc-mute)]">
                    {p.category || " - "}
                  </td>
                  <td className="px-4 py-3 text-[var(--kc-mute)]">
                    {(p.vendorId && vendors?.[p.vendorId]) || " - "}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-[var(--kc-ink)]">
                    {formatKesMajor(p.price)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!filtered.length ? (
        <p className="px-4 py-12 text-center text-[13px] text-[var(--kc-faint)]">
          No products match this view
        </p>
      ) : (
        <div className="border-t border-[var(--kc-line-soft)] px-4 py-2.5 text-[12px] text-[var(--kc-faint)]">
          {filtered.length} products
        </div>
      )}
    </div>
  );
}
