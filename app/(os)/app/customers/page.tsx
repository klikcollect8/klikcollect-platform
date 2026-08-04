"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/os/ModuleShell";
import { osUi } from "@/components/os/os-ui";
import { formatKesMinor } from "@/lib/money";
import { cn } from "@/lib/utils";

type Customer = {
  id: string;
  publicId: string;
  vendorPublicId: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  notes: string | null;
  tags: string[];
  loyaltyPoints?: number;
  storeCreditMinor?: number;
  orderCount: number;
  totalSpentMinor: number;
  lastOrderAt: string | null;
  segment: "VIP" | "Regular" | "New" | "Inactive";
};

type CustomerOrder = {
  id: string;
  orderNumber: string;
  status: string;
  totalMinor: number;
  createdAt: string;
};

export default function OsCustomersPage() {
  const [vendorId, setVendorId] = useState("");
  const [rows, setRows] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const [history, setHistory] = useState<CustomerOrder[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const load = (vid?: string) =>
    void fetch(
      vid
        ? `/api/os/customers?vendorId=${encodeURIComponent(vid)}`
        : "/api/os/customers",
    )
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error.message || "Failed to load");
        else {
          setError(null);
          setRows(j.data || []);
        }
      });

  useEffect(() => {
    void fetch("/api/os/me")
      .then((r) => r.json())
      .then((b) => {
        const id = b?.data?.vendorIds?.[0] || "";
        setVendorId(id);
        load(id || undefined);
      });
  }, []);

  const current = rows.find((c) => c.id === selected) || null;

  useEffect(() => {
    if (!current) return;
    setNotes(current.notes || "");
    setTags((current.tags || []).join(", "));
    setStatus(null);
    setHistory([]);
    void fetch(
      `/api/os/customers?id=${encodeURIComponent(current.publicId || current.id)}${
        vendorId ? `&vendorId=${encodeURIComponent(vendorId)}` : ""
      }`,
    )
      .then((r) => r.json())
      .then((j) => {
        const orders = (j?.data?.orders || []) as Array<{
          id: string;
          orderNumber: string;
          status: string;
          totalMinor: number;
          createdAt: string;
        }>;
        setHistory(orders.slice(0, 12));
      });
  }, [current?.id, vendorId]);

  async function save() {
    if (!current || !vendorId) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/os/customers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: current.id,
          vendorId,
          notes,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setStatus(j.error?.message || "Save failed");
        return;
      }
      setStatus("Saved");
      await load(vendorId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModuleShell
      title="Customers"
      description="Your CRM - segments, notes, and tags. No platform curation mix-in."
      live
    >
      {error ? (
        <p className={cn("mb-4 text-[13px]", osUi.danger)}>{error}</p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="divide-y divide-black/[0.06] border-b border-black/10">
          <div className="flex items-baseline justify-between pb-3">
            <p className={osUi.sectionLabel}>{rows.length} customers</p>
          </div>
          {rows.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelected(c.id)}
              className={cn(
                "flex w-full items-start justify-between gap-3 py-3.5 text-left transition-colors",
                selected === c.id
                  ? "text-black"
                  : "text-black/55 hover:text-black",
              )}
            >
              <div className="min-w-0">
                <p className="truncate text-[15px] font-medium">
                  {c.name || c.email || c.phone || "Customer"}
                </p>
                <p className={cn("mt-0.5 truncate text-[12px]", osUi.muted)}>
                  {[c.email, c.phone].filter(Boolean).join(" · ") || " - "}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[12px] font-medium uppercase tracking-wider">
                  {c.segment}
                </p>
                <p
                  className={cn("mt-0.5 text-[12px] tabular-nums", osUi.muted)}
                >
                  {c.orderCount} · {formatKesMinor(c.totalSpentMinor)}
                </p>
              </div>
            </button>
          ))}
          {!rows.length ? (
            <p className={cn("py-10 text-center text-[13px]", osUi.muted)}>
              No customers yet - they appear from orders and POS
            </p>
          ) : null}
        </div>

        <aside className="h-fit border-t border-black/10 pt-4 lg:sticky lg:top-16 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          {!current ? (
            <p className={cn("py-10 text-center text-[13px]", osUi.muted)}>
              Select a customer
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className={osUi.pageEyebrow}>{current.segment}</p>
                <h2 className="mt-1 text-[20px] font-medium text-black">
                  {current.name || "Customer"}
                </h2>
                <p className={cn("mt-1 text-[13px]", osUi.muted)}>
                  {[current.email, current.phone].filter(Boolean).join(" · ")}
                </p>
                <p className={cn("mt-2 text-[13px] tabular-nums", osUi.muted)}>
                  {current.orderCount} orders ·{" "}
                  {formatKesMinor(current.totalSpentMinor)} spent
                  {current.lastOrderAt
                    ? ` · last ${new Date(current.lastOrderAt).toLocaleDateString("en-KE")}`
                    : ""}
                </p>
                <p className={cn("mt-1 text-[12px]", osUi.muted)}>
                  Loyalty · {current.loyaltyPoints ?? 0} pts
                  {current.storeCreditMinor
                    ? ` · credit ${formatKesMinor(current.storeCreditMinor)}`
                    : ""}
                </p>
                {current.tags?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {current.tags.map((t) => (
                      <span
                        key={t}
                        className="border border-black/15 px-2 py-0.5 text-[11px] uppercase tracking-[0.12em] text-black/55"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <label className="block">
                <span className={osUi.sectionLabel}>Notes</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className={cn("mt-1 min-h-[90px]", osUi.input)}
                />
              </label>

              <label className="block">
                <span className={osUi.sectionLabel}>
                  Tags (comma-separated)
                </span>
                <input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className={cn("mt-1", osUi.input)}
                  placeholder="wholesale, preferred"
                />
              </label>

              {status ? (
                <p className="text-[12px] text-black/60">{status}</p>
              ) : null}

              <button
                type="button"
                disabled={busy || !vendorId}
                onClick={() => void save()}
                className={cn(osUi.btnPrimary, "w-full")}
              >
                {busy ? "Saving…" : "Save notes & tags"}
              </button>

              <div className="border-t border-black/10 pt-4">
                <p className={osUi.sectionLabel}>Purchase history</p>
                {!history.length ? (
                  <p className={cn("mt-2 text-[13px]", osUi.muted)}>
                    No matching orders yet.
                  </p>
                ) : (
                  <ul className="mt-2 divide-y divide-black/[0.06]">
                    {history.map((o) => (
                      <li
                        key={o.id}
                        className="flex items-center justify-between gap-2 py-2 text-[13px]"
                      >
                        <div>
                          <p className="font-medium text-black">
                            {o.orderNumber}
                          </p>
                          <p className={cn("text-[11px]", osUi.muted)}>
                            {new Date(o.createdAt).toLocaleDateString("en-KE")}{" "}
                            · {o.status}
                          </p>
                        </div>
                        <span className="tabular-nums text-black">
                          {formatKesMinor(o.totalMinor)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </ModuleShell>
  );
}
