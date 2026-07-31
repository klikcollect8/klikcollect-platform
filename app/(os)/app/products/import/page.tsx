"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ModuleShell } from "@/components/os/ModuleShell";
import { OsAuthGate } from "@/components/os/OsAuthGate";
import { messages } from "@/messages/en-KE";
import { formatKesMajor } from "@/lib/money";
import { DEMO_VENDOR_ID } from "@/lib/tenancy";
import { track } from "@/lib/track";

const SAMPLE = `name,category,price,stock,description
Organic broccoli,Fresh Produce,220,40,Fresh organic broccoli crown
Extra virgin olive oil,Pantry,890,28,Cold-pressed olive oil
Organic milk,Dairy & Eggs,240,50,Full-cream organic milk`;

type DryRun = {
  summary: { rows: number; valid: number; invalid: number };
  preview: Array<{
    row: number;
    name: string;
    category: string;
    priceMajor: number;
    stock: number;
    ok: boolean;
  }>;
  errors: Array<{ row: number; field?: string; message: string }>;
};

export default function ImportDryRunPage() {
  const router = useRouter();
  const [csv, setCsv] = useState(SAMPLE);
  const [result, setResult] = useState<DryRun | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [committed, setCommitted] = useState<number | null>(null);

  async function runDryRun() {
    setBusy(true);
    setError("");
    setResult(null);
    setCommitted(null);
    try {
      track("os.import_dry_run_clicked", {}, "vendor");
      const res = await fetch("/api/products/import/dry-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || "Dry-run failed");
        return;
      }
      setResult(json.data as DryRun);
    } finally {
      setBusy(false);
    }
  }

  async function commitImport() {
    if (!result?.summary.valid) return;
    setBusy(true);
    setError("");
    try {
      track("os.import_commit_clicked", { valid: result.summary.valid }, "vendor");
      const res = await fetch("/api/products/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, vendorId: DEMO_VENDOR_ID }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || "Commit failed");
        return;
      }
      setCommitted(json.data.created as number);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModuleShell
      title="Bulk import"
      description="CSV dry-run against V1 categories, then tenant-scoped commit to the founding vendor catalogue."
      live
      actions={
        <Link
          href="/app/products"
          className="rounded-full border border-neutral-200 px-6 py-3 text-sm font-medium hover:bg-neutral-50"
        >
          Back to catalogue
        </Link>
      }
    >
      <OsAuthGate title="Sign in to import catalogue">
      <div className="space-y-8">
        <div className="rounded-[28px] bg-neutral-50 p-6 sm:rounded-[32px] sm:p-8">
          <label className="mb-3 block text-center text-xs font-semibold uppercase tracking-widest text-neutral-400">
            CSV (name, category, price, stock)
          </label>
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={8}
            className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 font-mono text-xs outline-none focus:border-black sm:text-sm"
          />
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void runDryRun()}
              className="rounded-full bg-black px-8 py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy && !result ? "Checking…" : "Run dry-run"}
            </button>
          </div>
          {error ? <p className="mt-4 text-center text-sm text-red-600">{error}</p> : null}
          {committed !== null ? (
            <p className="mt-4 text-center text-sm text-neutral-700">
              Committed {committed} listings ·{" "}
              <Link href="/app/products" className="underline">
                View catalogue
              </Link>{" "}
              ·{" "}
              <Link href="/shop" className="underline">
                Preview shop
              </Link>
            </p>
          ) : null}
        </div>

        {result ? (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="rounded-[24px] bg-neutral-50 px-4 py-6">
                <div className="text-xs uppercase tracking-widest text-neutral-400">Rows</div>
                <div className="mt-1 text-3xl font-light">{result.summary.rows}</div>
              </div>
              <div className="rounded-[24px] bg-neutral-50 px-4 py-6">
                <div className="text-xs uppercase tracking-widest text-neutral-400">Valid</div>
                <div className="mt-1 text-3xl font-light">{result.summary.valid}</div>
              </div>
              <div className="rounded-[24px] bg-neutral-50 px-4 py-6">
                <div className="text-xs uppercase tracking-widest text-neutral-400">Invalid</div>
                <div className="mt-1 text-3xl font-light">{result.summary.invalid}</div>
              </div>
            </div>

            <div className="overflow-hidden rounded-[28px] bg-neutral-50">
              <div className="border-b border-neutral-200/60 px-6 py-4 text-center text-sm font-medium">
                Preview
              </div>
              <div className="divide-y divide-neutral-200/60">
                {result.preview.map((row) => (
                  <div
                    key={row.row}
                    className="flex flex-wrap items-center justify-between gap-2 px-6 py-3 text-sm"
                  >
                    <span className={row.ok ? "text-black" : "text-red-600"}>
                      #{row.row} {row.name}
                    </span>
                    <span className="text-neutral-500">
                      {row.category} · {formatKesMajor(row.priceMajor)} · stock {row.stock}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {result.errors.length ? (
              <div className="rounded-[28px] bg-neutral-50 px-6 py-6">
                <p className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-neutral-400">
                  Errors
                </p>
                <ul className="mx-auto max-w-xl space-y-2 text-sm text-neutral-600">
                  {result.errors.map((e, i) => (
                    <li key={i}>
                      Row {e.row}
                      {e.field ? ` · ${e.field}` : ""}: {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {result.summary.valid > 0 && committed === null ? (
              <div className="flex justify-center">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void commitImport()}
                  className="rounded-full bg-black px-8 py-3 text-sm font-medium text-white disabled:opacity-50"
                >
                  {busy ? "Committing…" : `Commit ${result.summary.valid} valid rows`}
                </button>
              </div>
            ) : null}

            <p className="text-center text-sm text-neutral-500">
              Writes to tenant {DEMO_VENDOR_ID} and appear on the curated storefront.
            </p>
          </div>
        ) : null}

        <p className="text-center text-xs text-neutral-400">{messages.os.m1Note}</p>
      </div>
      </OsAuthGate>
    </ModuleShell>
  );
}
