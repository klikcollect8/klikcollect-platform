"use client";

import { useEffect, useState } from "react";
import PageContainer, {
  AdminPageHeader,
} from "@/components/admin/PageContainer";
import AccessControl from "@/components/admin/AccessControl";
import SectionCard from "@/components/admin/SectionCard";
import { formatKesMajor } from "@/lib/money";

type Offer = {
  id: string;
  productId: string;
  vendorId: string;
  vendorName: string;
  price: number;
  stock: number;
  onHand: number;
  status: string;
};

function OffersInspectorContent() {
  const [rows, setRows] = useState<Offer[]>([]);
  const [productId, setProductId] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const q = productId
      ? `?productId=${encodeURIComponent(productId)}`
      : "";
    const res = await fetch(`/api/admin/offers${q}`);
    const json = await res.json();
    if (res.ok) setRows(json.data || []);
  };

  useEffect(() => {
    void load();
  }, []);

  const setStatus = async (offerId: string, status: string) => {
    setBusy(true);
    await fetch("/api/admin/offers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offerId, status }),
    });
    setBusy(false);
    void load();
  };

  return (
    <PageContainer>
      <AdminPageHeader
        title="Vendor offers"
        description="Inspect price and stock across vendors for the same canonical product."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          placeholder="Filter by product public id"
          className="min-w-[240px] flex-1 border border-black/15 px-3 py-2 text-[13px]"
        />
        <button
          type="button"
          onClick={() => void load()}
          className="bg-black px-4 py-2 text-[12px] font-medium uppercase tracking-wide text-white"
        >
          Load
        </button>
      </div>

      <SectionCard title={`${rows.length} offers`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="border-b border-black/10 text-[11px] uppercase tracking-wide text-black/40">
              <tr>
                <th className="py-2 pr-3">Offer</th>
                <th className="py-2 pr-3">Product</th>
                <th className="py-2 pr-3">Vendor</th>
                <th className="py-2 pr-3">Price</th>
                <th className="py-2 pr-3">Stock</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {rows.map((o) => (
                <tr key={o.id}>
                  <td className="py-3 pr-3 font-mono text-[11px]">{o.id}</td>
                  <td className="py-3 pr-3 font-mono text-[11px]">
                    {o.productId}
                  </td>
                  <td className="py-3 pr-3">
                    {o.vendorName || o.vendorId}
                  </td>
                  <td className="py-3 pr-3 tabular-nums">
                    {formatKesMajor(o.price)}
                  </td>
                  <td className="py-3 pr-3 tabular-nums">
                    {o.onHand ?? o.stock}
                  </td>
                  <td className="py-3 pr-3 capitalize">{o.status}</td>
                  <td className="py-3">
                    {o.status === "published" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void setStatus(o.id, "archived")}
                        className="text-[11px] uppercase tracking-wide text-red-800 underline"
                      >
                        Suspend
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void setStatus(o.id, "published")}
                        className="text-[11px] uppercase tracking-wide underline"
                      >
                        Restore
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length ? (
            <p className="py-8 text-center text-[13px] text-black/40">
              No offers loaded
            </p>
          ) : null}
        </div>
      </SectionCard>
    </PageContainer>
  );
}

export default function AdminOffersPage() {
  return (
    <AccessControl requiredPermission="offers:view">
      <OffersInspectorContent />
    </AccessControl>
  );
}
