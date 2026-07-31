"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Show, SignInButton } from "@clerk/nextjs";
import { Minus, Plus } from "lucide-react";
import { formatKesMajor } from "@/lib/money";
import { StatusBadge } from "@/components/os/StatusBadge";
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

export function InventoryBoard({ vendors }: { vendors?: Record<string, string> }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "err" } | null>(null);

  async function load() {
    const res = await fetch("/api/os/inventory");
    const json = await res.json();
    const data = (json.data || []) as Row[];
    setRows(data);
    setDrafts(
      Object.fromEntries(
        data.map((r) => [r.id, String(r.onHand ?? r.stock)]),
      ),
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
        body: JSON.stringify({ id, stock }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage({
          text: json?.error?.message || "Update failed — sign in if needed",
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
    <div className="space-y-3">
      <Show when="signed-out">
        <div className="flex items-center justify-between gap-3 rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-white px-4 py-3 text-[13px]">
          <span className="text-[var(--kc-mute)]">Sign in to adjust stock</span>
          <SignInButton mode="redirect">
            <button
              type="button"
              className="rounded-[var(--kc-radius-sm)] bg-[var(--kc-ink)] px-3 py-1.5 text-[12px] font-medium text-white"
            >
              Sign in
            </button>
          </SignInButton>
        </div>
      </Show>

      {message ? (
        <div
          className={cn(
            "rounded-[var(--kc-radius-sm)] px-3.5 py-2.5 text-[13px] font-medium",
            message.tone === "ok"
              ? "bg-[#e4f8e9] text-[#0c5132]"
              : "bg-[#fcebea] text-[#8e1b0d]",
          )}
        >
          {message.text}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="border-b border-[var(--kc-line-soft)] text-[12px] text-[var(--kc-faint)]">
              <tr>
                <th className="px-4 py-2.5 font-medium">Product</th>
                <th className="px-4 py-2.5 font-medium">Vendor</th>
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 font-medium">Price</th>
                <th className="px-4 py-2.5 font-medium">On hand</th>
                <th className="px-4 py-2.5 font-medium">Reserved</th>
                <th className="px-4 py-2.5 font-medium">Available</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--kc-line-soft)]">
              {rows.map((r) => {
                const onHand = r.onHand ?? r.stock;
                const reserved = r.reserved ?? 0;
                const available = r.available ?? Math.max(0, onHand - reserved);
                const status = available <= 0 ? "out" : available <= 5 ? "low" : "ok";
                const dirty =
                  drafts[r.id] !== undefined && drafts[r.id] !== String(onHand);
                return (
                  <tr key={r.id} className="hover:bg-[var(--kc-canvas)]">
                    <td className="px-4 py-3">
                      <Link
                        href={`/products/${r.id}`}
                        className="font-medium text-[var(--kc-ink)] hover:underline"
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
                          <span className="text-[11px] tabular-nums text-[var(--kc-faint)]">
                            {r.barcode}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--kc-mute)]">
                      {(r.vendorId && vendors?.[r.vendorId]) || "—"}
                    </td>
                    <td className="px-4 py-3 text-[var(--kc-mute)]">{r.category}</td>
                    <td className="px-4 py-3 tabular-nums text-[var(--kc-mute)]">
                      {formatKesMajor(r.price)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="inline-flex items-center rounded-[var(--kc-radius-sm)] border border-[var(--kc-line)]">
                        <button
                          type="button"
                          onClick={() => nudge(r.id, -1)}
                          className="px-2 py-1.5 text-[var(--kc-mute)] hover:bg-[var(--kc-canvas)]"
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
                          className="w-12 border-x border-[var(--kc-line)] px-1 py-1.5 text-center text-[13px] tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          onClick={() => nudge(r.id, 1)}
                          className="px-2 py-1.5 text-[var(--kc-mute)] hover:bg-[var(--kc-canvas)]"
                          aria-label="Increase"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-[var(--kc-mute)]">{reserved}</td>
                    <td className="px-4 py-3 tabular-nums font-medium text-[var(--kc-ink)]">
                      {available}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Show when="signed-in">
                        <button
                          type="button"
                          disabled={busy === r.id || !dirty}
                          onClick={() => void save(r.id)}
                          className={cn(
                            "rounded-[var(--kc-radius-sm)] px-3 py-1.5 text-[12px] font-medium disabled:opacity-40",
                            dirty
                              ? "bg-[var(--kc-ink)] text-white hover:bg-black"
                              : "border border-[var(--kc-line)] text-[var(--kc-faint)]",
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
        </div>
        {!rows.length ? (
          <p className="px-4 py-10 text-center text-[13px] text-[var(--kc-faint)]">No inventory</p>
        ) : null}
      </div>
    </div>
  );
}
