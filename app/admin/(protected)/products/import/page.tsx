"use client";

import { useState } from "react";
import Link from "next/link";
import AccessControl from "@/components/admin/AccessControl";
import PageContainer, {
  AdminPageHeader,
} from "@/components/admin/PageContainer";
import { adminUi } from "@/components/admin/admin-ui";
import { cn } from "@/lib/utils";

type PreviewRow = {
  row: number;
  name: string;
  category: string;
  priceMajor: number;
  stock: number;
  sku?: string;
  barcode?: string;
  ok: boolean;
  warnings: string[];
};

type RowError = {
  row: number;
  field?: string;
  level: "error" | "warn";
  message: string;
};

export default function CatalogueImportPage() {
  return (
    <AccessControl requiredPermission="products:create">
      <ImportInner />
    </AccessControl>
  );
}

function ImportInner() {
  const [csv, setCsv] = useState(
    "name,category,price,stock,description,sku,barcode,gtin\n",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    rows: number;
    valid: number;
    invalid: number;
    warnings: number;
  } | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [errors, setErrors] = useState<RowError[]>([]);
  const [canCommit, setCanCommit] = useState(false);
  const [commitMsg, setCommitMsg] = useState<string | null>(null);
  const [allowPartial, setAllowPartial] = useState(false);

  const onFile = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    setCsv(text);
    setCommitMsg(null);
  };

  const dryRun = async () => {
    setBusy(true);
    setError(null);
    setCommitMsg(null);
    try {
      const res = await fetch("/api/products/import/dry-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message || json.error || "Dry-run failed");
        return;
      }
      setSummary(json.data.summary);
      setPreview(json.data.preview || []);
      setErrors(json.data.errors || []);
      setCanCommit(Boolean(json.data.canCommit));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dry-run failed");
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    setBusy(true);
    setError(null);
    setCommitMsg(null);
    try {
      const res = await fetch("/api/products/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, allowPartial }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message || json.error || "Commit failed");
        if (json.data?.errors) setErrors(json.data.errors);
        return;
      }
      setCommitMsg(`Created ${json.data.created} draft product(s).`);
      setCanCommit(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Commit failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageContainer>
      <AdminPageHeader
        title="CSV import"
        description="Dry-run first. Commit creates draft catalogue products (all-or-nothing unless partial is enabled)."
      />

      <p className="mb-4 text-[13px] text-black/50">
        Required columns:{" "}
        <code className="text-[12px]">name,category,price,stock</code>. Optional:{" "}
        <code className="text-[12px]">description,sku,barcode,gtin</code>.{" "}
        <Link href="/admin/products" className="underline">
          Back to catalogue
        </Link>
      </p>

      {error ? (
        <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">
          {error}
        </p>
      ) : null}
      {commitMsg ? (
        <p className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-900">
          {commitMsg}
        </p>
      ) : null}

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className={cn(adminUi.btnSecondary, "cursor-pointer")}>
          Upload CSV
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0] || null)}
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void dryRun()}
          className={adminUi.btnSecondary}
        >
          Dry-run
        </button>
        <button
          type="button"
          disabled={busy || (!canCommit && !allowPartial)}
          onClick={() => void commit()}
          className={cn(adminUi.btnPrimary, "disabled:opacity-40")}
        >
          Commit import
        </button>
        <label className="flex items-center gap-2 text-[12px] text-black/55">
          <input
            type="checkbox"
            checked={allowPartial}
            onChange={(e) => setAllowPartial(e.target.checked)}
          />
          Allow partial (skip invalid rows)
        </label>
      </div>

      <textarea
        className={cn(adminUi.input, "min-h-[220px] font-mono text-[12px]")}
        value={csv}
        onChange={(e) => {
          setCsv(e.target.value);
          setCanCommit(false);
          setCommitMsg(null);
        }}
      />

      {summary ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          {[
            ["Rows", summary.rows],
            ["Valid", summary.valid],
            ["Invalid", summary.invalid],
            ["Warnings", summary.warnings],
          ].map(([label, value]) => (
            <div key={String(label)} className="border border-black/10 bg-white px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-black/40">
                {label}
              </p>
              <p className="mt-1 text-[22px] font-medium tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {errors.length ? (
        <div className="mt-6 border border-black/10 bg-white">
          <div className="border-b border-black/10 px-4 py-2 text-[13px] font-medium">
            Validation issues
          </div>
          <ul className="max-h-48 divide-y divide-black/5 overflow-y-auto text-[12px]">
            {errors.map((e, i) => (
              <li key={`${e.row}-${i}`} className="px-4 py-2">
                Row {e.row}
                {e.field ? ` · ${e.field}` : ""}: {e.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {preview.length ? (
        <div className="mt-6 overflow-x-auto border border-black/10 bg-white">
          <table className="min-w-full text-left text-[12px]">
            <thead className="border-b border-black/10 text-[11px] uppercase tracking-wide text-black/40">
              <tr>
                <th className="px-3 py-2">Row</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Price</th>
                <th className="px-3 py-2">Stock</th>
                <th className="px-3 py-2">OK</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {preview.map((r) => (
                <tr key={r.row} className={r.ok ? "" : "bg-red-50/40"}>
                  <td className="px-3 py-2 tabular-nums">{r.row}</td>
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2">{r.category}</td>
                  <td className="px-3 py-2 tabular-nums">{r.priceMajor}</td>
                  <td className="px-3 py-2 tabular-nums">{r.stock}</td>
                  <td className="px-3 py-2">{r.ok ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </PageContainer>
  );
}
