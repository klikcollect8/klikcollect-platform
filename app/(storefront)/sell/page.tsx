"use client";

import { useState } from "react";
import Link from "next/link";
import { V1_CATEGORIES } from "@/lib/curation-policy";
import { track } from "@/lib/track";
import { StorePage, StoreHeading } from "@/components/marketplace/StorePage";

const field =
  "w-full border border-black/12 bg-transparent px-4 py-3.5 text-[15px] outline-none focus:border-black/40";

export default function SellPage() {
  const [businessName, setBusinessName] = useState("");
  const [neighbourhood, setNeighbourhood] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function toggleCategory(c: string) {
    setCategories((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c].slice(0, 3),
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      track("vendor.apply_submitted", { businessName }, "vendor");
      const res = await fetch("/api/curation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName,
          neighbourhood,
          contactEmail,
          contactPhone,
          categories,
          notes,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || "Could not submit");
        return;
      }
      setDone(json.data.id);
      setBusinessName("");
      setNeighbourhood("");
      setContactEmail("");
      setContactPhone("");
      setCategories([]);
      setNotes("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <StorePage narrow>
      <StoreHeading
        eyebrow="Sell"
        title="Apply to sell"
        description="Tell us about your products. We'll review your application."
      />

      {done ? (
        <div className="border-t border-black/[0.06] py-16 text-center">
          <p className="text-[12px] uppercase tracking-[0.2em] text-black/40">Received</p>
          <p className="mt-4 text-[22px] font-medium tracking-tight">{done}</p>
          <p className="mt-3 text-[15px] text-black/50">We'll get back to you after review.</p>
          <Link
            href="/shop"
            className="mt-10 inline-flex bg-black px-8 py-4 text-[12px] font-medium uppercase tracking-[0.16em] text-white hover:opacity-80"
          >
            Continue shopping
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5 border-t border-black/[0.06] pt-12">
          <input
            required
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Business name"
            className={field}
          />
          <input
            value={neighbourhood}
            onChange={(e) => setNeighbourhood(e.target.value)}
            placeholder="Area"
            className={field}
          />
          <input
            required
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="Email"
            className={field}
          />
          <input
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="Phone (optional)"
            className={field}
          />

          <div className="pt-4">
            <p className="mb-4 text-[12px] uppercase tracking-[0.18em] text-black/40">
              Categories (max 3)
            </p>
            <div className="flex flex-wrap gap-2">
              {V1_CATEGORIES.map((c) => {
                const on = categories.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCategory(c)}
                    className={`min-h-11 border px-3.5 py-2.5 text-[13px] ${
                      on
                        ? "border-black bg-black text-white"
                        : "border-black/12 text-black/60 hover:border-black/30"
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="About your products"
            className={`${field} resize-none`}
          />

          {error ? <p className="text-[14px] text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={busy}
            className="mt-4 w-full bg-black py-4 text-[12px] font-medium uppercase tracking-[0.16em] text-white disabled:opacity-50 hover:opacity-80"
          >
            {busy ? "Submitting…" : "Submit application"}
          </button>
        </form>
      )}
    </StorePage>
  );
}
