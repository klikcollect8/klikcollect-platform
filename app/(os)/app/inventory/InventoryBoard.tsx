"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Show, SignInButton } from "@clerk/nextjs";
import { Minus, Plus } from "lucide-react";
import { formatKesMajor } from "@/lib/money";
import { StatusBadge } from "@/components/os/StatusBadge";
import { osUi } from "@/components/os/os-ui";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  onHand?: number;
  reserved?: number;
  available?: number;
  barcode?: string;
  vendorId?: string;
};

type Movement = {
  id: string;
  productId: string;
  vendorId: string;
  type: string;
  onHandDelta: number;
  reservedDelta: number;
  reason: string;
  createdAt: string;
};

const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "movements", label: "Movements" },
  { id: "adjust", label: "Adjust" },
] as const;

export function InventoryBoard({
  vendors,
}: {
  vendors?: Record<string, string>;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("dashboard");
  const [rows, setRows] = useState<Row[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    text: string;
    tone: "ok" | "err";
  } | null>(null);

  async function load() {
    const [invRes, movRes] = await Promise.all([
      fetch("/api/os/inventory"),
      fetch("/api/os/inventory?movements=1"),
    ]);
    const invJson = await invRes.json();
    const movJson = await movRes.json();
    const data = (invJson.data || []) as Row[];
    setRows(data);
    setMovements((movJson.data || []) as Movement[]);
    setDrafts(
      Object.fromEntries(data.map((r) => [r.id, String(r.onHand ?? r.stock)])),
    );
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(t);
  }, [message]);

  const heuristics = useMemo(() => {
    const saleByProduct = new Map<string, number>();
    for (const m of movements) {
      if (m.type === "sale" || m.type === "commit") {
        saleByProduct.set(
          m.productId,
          (saleByProduct.get(m.productId) || 0) + Math.abs(m.onHandDelta),
        );
      }
    }
    const withAvail = rows.map((r) => {
      const available =
        r.available ?? Math.max(0, (r.onHand ?? r.stock) - (r.reserved ?? 0));
      return { ...r, available, velocity: saleByProduct.get(r.id) || 0 };
    });
    return {
      low: withAvail.filter((r) => r.available > 0 && r.available <= 5),
      out: withAvail.filter((r) => r.available <= 0),
      fast: withAvail
        .filter((r) => r.velocity > 0)
        .sort((a, b) => b.velocity - a.velocity)
        .slice(0, 8),
      slow: withAvail
        .filter((r) => r.available > 5 && r.velocity === 0)
        .slice(0, 8),
    };
  }, [rows, movements]);

  function nudge(id: string, delta: number) {
    setDrafts((d) => {
      const next = Math.max(0, (Number(d[id]) || 0) + delta);
      return { ...d, [id]: String(next) };
    });
  }

  async function save(id: string) {
    const stock = Number(drafts[id]);
    if (!Number.isInteger(stock) || stock < 0) {
      setMessage({ text: "Stock must be a non-negative integer", tone: "err" });
      return;
    }
    setBusy(id);
    try {
      const res = await fetch("/api/os/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, stock, reason: "adjust" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage({
          text: json?.error?.message || "Update failed - sign in if needed",
          tone: "err",
        });
        return;
      }
      await load();
      setMessage({ text: "Stock updated", tone: "ok" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <Show when="signed-out">
        <div className="flex items-center justify-between gap-3 border-b border-black/10 py-3 text-[13px]">
          <span className={osUi.muted}>Sign in to adjust stock</span>
          <SignInButton mode="redirect">
            <button type="button" className={osUi.btnPrimary}>
              Sign in
            </button>
          </SignInButton>
        </div>
      </Show>

      {message ? (
        <div
          className={cn(
            "px-1 py-2 text-[13px] font-medium",
            message.tone === "ok" ? osUi.success : osUi.danger,
          )}
        >
          {message.text}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1 border-b border-black/10 pb-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "px-3 py-2 text-[12px] font-medium uppercase tracking-[0.12em] transition-colors",
              tab === t.id ? "text-black" : "text-black/40 hover:text-black",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "dashboard" ? (
        <div className="grid gap-8 lg:grid-cols-2">
          <HeuristicList
            title="Low stock"
            empty="Nothing low"
            rows={heuristics.low}
            vendors={vendors}
          />
          <HeuristicList
            title="Out of stock"
            empty="Nothing out"
            rows={heuristics.out}
            vendors={vendors}
          />
          <HeuristicList
            title="Fast movers"
            empty="No recent sales velocity"
            rows={heuristics.fast}
            vendors={vendors}
            showVelocity
          />
          <HeuristicList
            title="Slow movers"
            empty="No idle stock flagged"
            rows={heuristics.slow}
            vendors={vendors}
          />
        </div>
      ) : null}

      {tab === "movements" ? (
        <div className="divide-y divide-black/[0.06] border-b border-black/10">
          {movements.map((m) => (
            <div
              key={m.id}
              className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-[13px]"
            >
              <div>
                <p className="font-medium text-black">
                  {m.type} · {m.productId}
                </p>
                <p className={cn("mt-0.5 text-[12px]", osUi.muted)}>
                  {m.reason}
                  {m.vendorId && vendors?.[m.vendorId]
                    ? ` · ${vendors[m.vendorId]}`
                    : ""}
                </p>
              </div>
              <div className="text-right tabular-nums">
                <p className="font-medium">
                  {m.onHandDelta > 0 ? "+" : ""}
                  {m.onHandDelta}
                  {m.reservedDelta
                    ? ` / r${m.reservedDelta > 0 ? "+" : ""}${m.reservedDelta}`
                    : ""}
                </p>
                <p className={cn("text-[11px]", osUi.muted)}>
                  {new Date(m.createdAt).toLocaleString("en-KE")}
                </p>
              </div>
            </div>
          ))}
          {!movements.length ? (
            <p className={cn("py-10 text-center text-[13px]", osUi.muted)}>
              No movements yet
            </p>
          ) : null}
        </div>
      ) : null}

      {tab === "adjust" ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead
              className={cn("border-b border-black/10 text-[12px]", osUi.muted)}
            >
              <tr>
                <th className="px-1 py-2.5 font-medium">Product</th>
                <th className="px-1 py-2.5 font-medium">Vendor</th>
                <th className="px-1 py-2.5 font-medium">On hand</th>
                <th className="px-1 py-2.5 font-medium">Reserved</th>
                <th className="px-1 py-2.5 font-medium">Available</th>
                <th className="px-1 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06]">
              {rows.map((r) => {
                const onHand = r.onHand ?? r.stock;
                const reserved = r.reserved ?? 0;
                const available = r.available ?? Math.max(0, onHand - reserved);
                const status =
                  available <= 0 ? "out" : available <= 5 ? "low" : "ok";
                const dirty =
                  drafts[r.id] !== undefined && drafts[r.id] !== String(onHand);
                return (
                  <tr key={r.id}>
                    <td className="px-1 py-3">
                      <Link
                        href={`/app/products/${r.id}`}
                        className="font-medium text-black hover:underline"
                      >
                        {r.name}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <StatusBadge
                          status={status}
                          label={
                            status === "ok"
                              ? "In stock"
                              : status === "low"
                                ? "Low stock"
                                : "Out"
                          }
                        />
                        {r.barcode ? (
                          <span
                            className={cn(
                              "text-[11px] tabular-nums",
                              osUi.muted,
                            )}
                          >
                            {r.barcode}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className={cn("px-1 py-3", osUi.muted)}>
                      {(r.vendorId && vendors?.[r.vendorId]) || " - "}
                    </td>
                    <td className="px-1 py-3">
                      <div className="inline-flex items-center border border-black/15">
                        <button
                          type="button"
                          onClick={() => nudge(r.id, -1)}
                          className="px-2 py-1.5 text-black/50 hover:text-black"
                          aria-label="Decrease"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={drafts[r.id] ?? String(onHand)}
                          onChange={(e) =>
                            setDrafts((d) => ({ ...d, [r.id]: e.target.value }))
                          }
                          className="w-12 border-x border-black/15 px-1 py-1.5 text-center text-[13px] tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          onClick={() => nudge(r.id, 1)}
                          className="px-2 py-1.5 text-black/50 hover:text-black"
                          aria-label="Increase"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className={cn("px-1 py-3 tabular-nums", osUi.muted)}>
                      {reserved}
                    </td>
                    <td className="px-1 py-3 tabular-nums font-medium text-black">
                      {available}
                    </td>
                    <td className="px-1 py-3 text-right">
                      <Show when="signed-in">
                        <button
                          type="button"
                          disabled={busy === r.id || !dirty}
                          onClick={() => void save(r.id)}
                          className={cn(
                            dirty ? osUi.btnPrimary : osUi.btnGhost,
                            "disabled:opacity-40",
                          )}
                        >
                          {busy === r.id ? "…" : "Save"}
                        </button>
                      </Show>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!rows.length ? (
            <p className={cn("py-10 text-center text-[13px]", osUi.muted)}>
              No inventory
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function HeuristicList({
  title,
  empty,
  rows,
  vendors,
  showVelocity,
}: {
  title: string;
  empty: string;
  rows: Array<Row & { available: number; velocity?: number }>;
  vendors?: Record<string, string>;
  showVelocity?: boolean;
}) {
  return (
    <div>
      <h3 className={osUi.sectionLabel}>{title}</h3>
      <div className="mt-3 divide-y divide-black/[0.06]">
        {rows.map((r) => (
          <div
            key={r.id}
            className="flex items-baseline justify-between gap-3 py-2.5 text-[13px]"
          >
            <div className="min-w-0">
              <Link
                href={`/app/products/${r.id}`}
                className="font-medium text-black hover:underline"
              >
                {r.name}
              </Link>
              <p className={cn("truncate text-[12px]", osUi.muted)}>
                {(r.vendorId && vendors?.[r.vendorId]) || r.category}
                {showVelocity && r.velocity
                  ? ` · ${r.velocity} units moved`
                  : ""}
              </p>
            </div>
            <span className="shrink-0 tabular-nums font-medium">
              {formatKesMajor(r.price)} · {r.available}
            </span>
          </div>
        ))}
        {!rows.length ? (
          <p className={cn("py-6 text-[13px]", osUi.muted)}>{empty}</p>
        ) : null}
      </div>
    </div>
  );
}
