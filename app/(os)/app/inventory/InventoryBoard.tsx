"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Show } from "@clerk/nextjs";
import AuthModalTrigger from "@/components/auth/AuthModalTrigger";
import { Minus, Plus } from "lucide-react";
import { formatKesMajor } from "@/lib/money";
import { StatusBadge } from "@/components/os/StatusBadge";
import { OsFilterRail } from "@/components/os/OsFilterRail";
import { OsEmptyState } from "@/components/os/OsEmptyState";
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
  { id: "dashboard", label: "Overview" },
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
  const [q, setQ] = useState("");
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

  const adjustRows = useMemo(() => {
    if (!q.trim()) return rows;
    const needle = q.toLowerCase();
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(needle) ||
        (r.barcode || "").toLowerCase().includes(needle) ||
        (r.category || "").toLowerCase().includes(needle),
    );
  }, [rows, q]);

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
    <div className="space-y-5">
      <Show when="signed-out">
        <div className="flex items-center justify-between gap-3 border-b border-black/10 py-3 text-[13px]">
          <span className={osUi.muted}>Sign in to adjust stock</span>
          <AuthModalTrigger redirect="/app/inventory" className={osUi.btnPrimary}>
            Sign in
          </AuthModalTrigger>
        </div>
      </Show>

      {message ? (
        <div
          className={cn(
            "py-2 text-[13px] font-medium",
            message.tone === "ok" ? osUi.success : osUi.danger,
          )}
        >
          {message.text}
        </div>
      ) : null}

      <OsFilterRail
        options={TABS.map((t) => ({ id: t.id, label: t.label }))}
        value={tab}
        onChange={(id) => setTab(id as (typeof TABS)[number]["id"])}
      />

      {tab === "dashboard" ? (
        <div className="space-y-10">
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
        <div className="divide-y divide-black/10 border-y border-black/10">
          {movements.map((m) => (
            <div
              key={m.id}
              className="flex flex-wrap items-baseline justify-between gap-2 py-3.5 text-[13px]"
            >
              <div className="min-w-0">
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
            <OsEmptyState
              title="No movements yet"
              body="Sales and adjustments will show here."
            />
          ) : null}
        </div>
      ) : null}

      {tab === "adjust" ? (
        <div className="space-y-4">
          <label className="block">
            <span className="sr-only">Search stock</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name or barcode…"
              className="w-full border-b border-black/15 bg-transparent py-3 text-[15px] outline-none placeholder:text-black/35 focus:border-black/50"
            />
          </label>
          <div className="divide-y divide-black/10 border-y border-black/10">
            {adjustRows.map((r) => {
              const onHand = r.onHand ?? r.stock;
              const reserved = r.reserved ?? 0;
              const available = r.available ?? Math.max(0, onHand - reserved);
              const status =
                available <= 0 ? "out" : available <= 5 ? "low" : "ok";
              const dirty =
                drafts[r.id] !== undefined && drafts[r.id] !== String(onHand);
              return (
                <div key={r.id} className="space-y-3 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/app/products/${r.id}`}
                        className="text-[15px] font-medium text-black hover:underline"
                      >
                        {r.name}
                      </Link>
                      <p className="mt-1 text-[12px] text-black/40">
                        Avail {available} · Reserved {reserved} ·{" "}
                        {formatKesMajor(r.price)}
                      </p>
                    </div>
                    <StatusBadge
                      status={status}
                      label={
                        status === "ok"
                          ? "In stock"
                          : status === "low"
                            ? "Low"
                            : "Out"
                      }
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="inline-flex items-center border border-black/15">
                      <button
                        type="button"
                        onClick={() => nudge(r.id, -1)}
                        className="flex h-11 w-11 items-center justify-center text-black/50 hover:text-black"
                        aria-label="Decrease"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={drafts[r.id] ?? String(onHand)}
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [r.id]: e.target.value }))
                        }
                        className="h-11 w-14 border-x border-black/15 text-center text-[15px] tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <button
                        type="button"
                        onClick={() => nudge(r.id, 1)}
                        className="flex h-11 w-11 items-center justify-center text-black/50 hover:text-black"
                        aria-label="Increase"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <Show when="signed-in">
                      <button
                        type="button"
                        disabled={busy === r.id || !dirty}
                        onClick={() => void save(r.id)}
                        className={cn(
                          dirty ? osUi.btnPrimary : osUi.btnGhost,
                          "min-h-11 disabled:opacity-40",
                        )}
                      >
                        {busy === r.id ? "…" : "Save"}
                      </button>
                    </Show>
                  </div>
                </div>
              );
            })}
          </div>
          {!adjustRows.length ? (
            <OsEmptyState
              title="No inventory"
              body="Assigned products will appear here for stock adjustments."
              actionLabel="My products"
              actionHref="/app/products"
            />
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
      <div className="mt-3 divide-y divide-black/10 border-y border-black/10">
        {rows.map((r) => (
          <Link
            key={r.id}
            href={`/app/products/${r.id}`}
            className="flex min-h-14 items-baseline justify-between gap-3 py-3.5 text-[13px] transition-opacity hover:opacity-70"
          >
            <div className="min-w-0">
              <p className="font-medium text-black">{r.name}</p>
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
          </Link>
        ))}
        {!rows.length ? (
          <p className={cn("py-6 text-[13px]", osUi.muted)}>{empty}</p>
        ) : null}
      </div>
    </div>
  );
}
