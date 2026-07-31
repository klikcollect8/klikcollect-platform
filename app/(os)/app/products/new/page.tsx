"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ModuleShell } from "@/components/os/ModuleShell";
import { OsAuthGate } from "@/components/os/OsAuthGate";
import { V1_CATEGORIES } from "@/lib/curation-policy";
import { DEMO_VENDOR_ID } from "@/lib/tenancy";
import { track } from "@/lib/track";

export default function NewProductPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>(V1_CATEGORIES[0]);
  const [price, setPrice] = useState("2500");
  const [stock, setStock] = useState("10");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      track("os.product_create_submitted", { category }, "vendor");
      const res = await fetch("/api/products/catalogue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category,
          priceMajor: Number(price),
          stock: Number(stock),
          description,
          vendorId: DEMO_VENDOR_ID,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || "Could not create product");
        return;
      }
      router.push("/app/products");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModuleShell
      title="New listing"
      description="Manual catalogue write — tenant-scoped to the founding vendor demo tenant."
      live
      actions={
        <Link
          href="/app/products"
          className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium hover:bg-neutral-50"
        >
          Back
        </Link>
      }
    >
      <OsAuthGate title="Sign in to list products">
        <form onSubmit={submit} className="max-w-xl space-y-3 rounded-xl border border-neutral-200 bg-white p-5">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Product name"
            className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-neutral-900"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-900"
          >
            {V1_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input
              required
              type="number"
              min={0}
              step={1}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Price (KES)"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-neutral-900"
            />
            <input
              required
              type="number"
              min={0}
              step={1}
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              placeholder="Stock"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-neutral-900"
            />
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Honest product description"
            rows={4}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-neutral-900"
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-xs text-neutral-400">Tenant {DEMO_VENDOR_ID}</p>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "Saving…" : "Publish listing"}
            </button>
          </div>
        </form>
      </OsAuthGate>
    </ModuleShell>
  );
}
