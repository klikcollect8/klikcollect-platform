"use client";

import { useEffect, useState } from "react";
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
  created_at: string;
};

function CatalogueCorrectionsContent() {
  const [rows, setRows] = useState<Correction[]>([]);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("open");

  const load = async () => {
    const q = filter ? `?status=${encodeURIComponent(filter)}` : "";
    const res = await fetch(`/api/admin/catalogue-corrections${q}`);
    const json = await res.json();
    if (res.ok) setRows(json.data || []);
  };

  useEffect(() => {
    void load();
  }, [filter]);

  const setStatus = async (publicId: string, status: string) => {
    setBusy(true);
    await fetch("/api/admin/catalogue-corrections", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicId, status }),
    });
    setBusy(false);
    void load();
  };

  return (
    <PageContainer>
      <AdminPageHeader
        title="Catalogue corrections"
        description="Vendor requests to fix platform-owned product data."
      />
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
          {rows.map((r) => (
            <div key={r.public_id} className="flex flex-col gap-2 py-4 sm:flex-row sm:justify-between">
              <div className="min-w-0">
                <p className="text-[14px] font-medium">{r.message}</p>
                <p className="mt-1 text-[12px] text-black/45">
                  Product {r.product_public_id} · Vendor {r.vendor_public_id} ·{" "}
                  {new Date(r.created_at).toLocaleString("en-KE")}
                </p>
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
                  onClick={() => void setStatus(r.public_id, "resolved")}
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
          ))}
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
