"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AccessControl from "@/components/admin/AccessControl";
import PageContainer, {
  AdminPageHeader,
} from "@/components/admin/PageContainer";
import { adminUi } from "@/components/admin/admin-ui";
import { cn } from "@/lib/utils";

type BarcodeRow = {
  publicId: string;
  name: string;
  barcode: string | null;
  gtin: string | null;
  additionalBarcodes: string[];
  status: string;
  updatedAt: string;
};

export default function BarcodeManagementPage() {
  return (
    <AccessControl requiredPermission="products:view">
      <BarcodesInner />
    </AccessControl>
  );
}

function BarcodesInner() {
  const [q, setQ] = useState("");
  const [missingOnly, setMissingOnly] = useState(false);
  const [items, setItems] = useState<BarcodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<BarcodeRow | null>(null);
  const [barcode, setBarcode] = useState("");
  const [gtin, setGtin] = useState("");
  const [additionalText, setAdditionalText] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<{
    assignments: Array<Record<string, unknown>>;
    scanEvents: Array<Record<string, unknown>>;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "60" });
      if (q.trim()) params.set("q", q.trim());
      if (missingOnly) params.set("missing", "1");
      const res = await fetch(`/api/admin/catalogue/barcodes?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load");
        return;
      }
      setItems(data.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [q, missingOnly]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 220);
    return () => clearTimeout(t);
  }, [load]);

  const openRow = async (row: BarcodeRow) => {
    setSelected(row);
    setBarcode(row.barcode || "");
    setGtin(row.gtin || "");
    setAdditionalText(row.additionalBarcodes.join("\n"));
    setReason("");
    setHistory(null);
    try {
      const res = await fetch(
        `/api/admin/catalogue/barcodes?productId=${encodeURIComponent(row.publicId)}`,
      );
      const data = await res.json();
      if (res.ok) setHistory(data);
    } catch {
      /* ignore */
    }
  };

  const save = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const additionalBarcodes = additionalText
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/admin/catalogue/barcodes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productPublicId: selected.publicId,
          barcode: barcode.trim() || null,
          gtin: gtin.trim() || null,
          additionalBarcodes,
          reason: reason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save barcodes");
        return;
      }
      await load();
      await openRow({
        ...selected,
        barcode: data.product.barcode,
        gtin: data.product.gtin,
        additionalBarcodes: data.product.additionalBarcodes || [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageContainer>
      <AdminPageHeader
        title="Barcode management"
        description="Primary, GTIN, and additional barcodes with uniqueness checks and assignment history."
      />

      {error ? (
        <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">
          {error}
        </p>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          className={cn(adminUi.input, "max-w-sm")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or barcode…"
        />
        <label className="flex items-center gap-2 text-[12px] text-black/55">
          <input
            type="checkbox"
            checked={missingOnly}
            onChange={(e) => setMissingOnly(e.target.checked)}
          />
          Missing primary barcode
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="border border-black/10 bg-white">
          <div className="border-b border-black/10 px-4 py-2 text-[13px] font-medium">
            {loading ? "Loading…" : `${items.length} products`}
          </div>
          <ul className="max-h-[70vh] divide-y divide-black/5 overflow-y-auto">
            {items.map((row) => (
              <li key={row.publicId}>
                <button
                  type="button"
                  onClick={() => void openRow(row)}
                  className={cn(
                    "flex w-full flex-col items-start px-4 py-3 text-left text-[13px]",
                    selected?.publicId === row.publicId
                      ? "bg-black/[0.03]"
                      : "hover:bg-black/[0.02]",
                  )}
                >
                  <span className="font-medium">{row.name}</span>
                  <span className="text-[11px] text-black/40">
                    {row.barcode || "—"} · +{row.additionalBarcodes.length}{" "}
                    extra · {row.status}
                  </span>
                </button>
              </li>
            ))}
            {!loading && !items.length ? (
              <li className="px-4 py-8 text-center text-[13px] text-black/40">
                No products matched
              </li>
            ) : null}
          </ul>
        </div>

        <div className="space-y-4">
          {selected ? (
            <>
              <div className="border border-black/10 bg-white p-4">
                <p className="text-[15px] font-medium">{selected.name}</p>
                <Link
                  href={`/admin/products/${selected.publicId}`}
                  className="text-[12px] text-black/45 underline"
                >
                  Open product
                </Link>
                <div className="mt-4 space-y-3">
                  <div>
                    <label className={adminUi.sectionLabel}>Primary barcode</label>
                    <input
                      className={adminUi.input}
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={adminUi.sectionLabel}>GTIN</label>
                    <input
                      className={adminUi.input}
                      value={gtin}
                      onChange={(e) => setGtin(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={adminUi.sectionLabel}>
                      Additional barcodes (one per line)
                    </label>
                    <textarea
                      className={cn(adminUi.input, "min-h-[100px]")}
                      value={additionalText}
                      onChange={(e) => setAdditionalText(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={adminUi.sectionLabel}>Reason</label>
                    <input
                      className={adminUi.input}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Pack redesign / corrected GTIN"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void save()}
                    className={cn(adminUi.btnPrimary, "disabled:opacity-40")}
                  >
                    {busy ? "Saving…" : "Save barcodes"}
                  </button>
                </div>
              </div>

              <div className="border border-black/10 bg-white p-4">
                <p className="text-[13px] font-medium">History</p>
                <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-[12px] text-black/55">
                  {(history?.assignments || []).map((h, i) => (
                    <li key={i}>
                      {String(h.action)} · {String(h.barcode)} ·{" "}
                      {h.created_at
                        ? new Date(String(h.created_at)).toLocaleString("en-KE")
                        : ""}
                    </li>
                  ))}
                  {!history?.assignments?.length ? (
                    <li>No assignment events yet</li>
                  ) : null}
                </ul>
                <p className="mt-4 text-[13px] font-medium">Scan events</p>
                <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-[12px] text-black/55">
                  {(history?.scanEvents || []).map((h, i) => (
                    <li key={i}>
                      {String(h.barcode)} · {String(h.resolution_status)} ·{" "}
                      {h.created_at
                        ? new Date(String(h.created_at)).toLocaleString("en-KE")
                        : ""}
                    </li>
                  ))}
                  {!history?.scanEvents?.length ? (
                    <li>No linked scan events</li>
                  ) : null}
                </ul>
              </div>
            </>
          ) : (
            <p className="border border-dashed border-black/15 px-4 py-10 text-center text-[13px] text-black/40">
              Select a product to manage barcodes
            </p>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
