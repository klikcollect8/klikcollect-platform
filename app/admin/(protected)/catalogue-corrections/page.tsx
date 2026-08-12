"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageContainer, {
  AdminPageHeader,
} from "@/components/admin/PageContainer";
import AccessControl from "@/components/admin/AccessControl";
import SectionCard from "@/components/admin/SectionCard";

type Correction = {
  public_id: string;
  product_public_id: string;
  offer_public_id?: string | null;
  vendor_public_id: string;
  message: string;
  status: string;
  admin_notes?: string | null;
  fields?: Record<string, string> | null;
  created_at: string;
};

function CatalogueCorrectionsContent() {
  const [rows, setRows] = useState<Correction[]>([]);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("open");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [applyOnResolve, setApplyOnResolve] = useState<Record<string, boolean>>(
    {},
  );
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const q = filter ? `?status=${encodeURIComponent(filter)}` : "";
    const res = await fetch(`/api/admin/catalogue-corrections${q}`);
    const json = await res.json();
    if (res.ok) setRows(json.data || []);
  };

  useEffect(() => {
    void load();
  }, [filter]);

  const setStatus = async (
    publicId: string,
    status: string,
    opts?: { applyFields?: boolean },
  ) => {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/catalogue-corrections", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicId,
        status,
        adminNotes: notes[publicId] || null,
        applyFields: Boolean(opts?.applyFields),
      }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(json.error?.message || "Update failed");
      return;
    }
    if (json.applied) {
      setMsg(`Resolved and applied: ${Object.keys(json.applied).join(", ")}`);
    }
    void load();
  };

  return (
    <PageContainer>
      <AdminPageHeader
        title="Catalogue corrections"
        description="Vendor requests to fix platform-owned product data. Resolving writes an audit event; optional field apply uses suggested values when present."
      />
      {msg ? (
        <p className="mb-3 text-[13px] text-emerald-800">{msg}</p>
      ) : null}
      <div className="mb-4 flex flex-wrap gap-2">
        {["open", "in_review", "resolved", "rejected"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded px-3 py-1.5 text-[12px] font-medium uppercase tracking-wide ${
              filter === s
                ? "bg-black text-white"
                : "border border-black/15 bg-white text-black/60"
            }`}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      <SectionCard title={`${rows.length} requests`}>
        <div className="divide-y divide-black/10">
          {rows.map((r) => {
            const fields = r.fields || {};
            const fieldKeys = Object.keys(fields);
            return (
              <div
                key={r.public_id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium">{r.message}</p>
                  <p className="mt-1 text-[12px] text-black/45">
                    Product{" "}
                    <Link
                      href={`/admin/products/${r.product_public_id}`}
                      className="underline"
                    >
                      {r.product_public_id}
                    </Link>{" "}
                    · Vendor {r.vendor_public_id} ·{" "}
                    {new Date(r.created_at).toLocaleString("en-KE")}
                  </p>
                  {fieldKeys.length ? (
                    <ul className="mt-2 space-y-0.5 text-[12px] text-black/55">
                      {fieldKeys.map((k) => (
                        <li key={k}>
                          <span className="font-medium">{k}</span>: {fields[k]}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <input
                    className="mt-2 w-full max-w-md border border-black/15 bg-white px-2 py-1.5 text-[12px]"
                    placeholder="Admin notes (audited)"
                    value={notes[r.public_id] || ""}
                    onChange={(e) =>
                      setNotes((prev) => ({
                        ...prev,
                        [r.public_id]: e.target.value,
                      }))
                    }
                  />
                  {r.status === "open" || r.status === "in_review" ? (
                    <label className="mt-2 flex items-center gap-2 text-[12px] text-black/55">
                      <input
                        type="checkbox"
                        checked={Boolean(applyOnResolve[r.public_id])}
                        onChange={(e) =>
                          setApplyOnResolve((prev) => ({
                            ...prev,
                            [r.public_id]: e.target.checked,
                          }))
                        }
                      />
                      Apply suggested field values on resolve (when not
                      &quot;needs_correction&quot;)
                    </label>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void setStatus(r.public_id, "in_review")}
                    className="border border-black/15 px-3 py-1.5 text-[11px] uppercase tracking-wide"
                  >
                    Review
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void setStatus(r.public_id, "resolved", {
                        applyFields: Boolean(applyOnResolve[r.public_id]),
                      })
                    }
                    className="bg-black px-3 py-1.5 text-[11px] uppercase tracking-wide text-white"
                  >
                    Resolve
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void setStatus(r.public_id, "rejected")}
                    className="border border-red-800/30 px-3 py-1.5 text-[11px] uppercase tracking-wide text-red-800"
                  >
                    Reject
                  </button>
                </div>
              </div>
            );
          })}
          {!rows.length ? (
            <p className="py-8 text-center text-[13px] text-black/40">
              No {filter} requests
            </p>
          ) : null}
        </div>
      </SectionCard>
    </PageContainer>
  );
}

export default function CatalogueCorrectionsPage() {
  return (
    <AccessControl requiredPermission="products:edit">
      <CatalogueCorrectionsContent />
    </AccessControl>
  );
}
