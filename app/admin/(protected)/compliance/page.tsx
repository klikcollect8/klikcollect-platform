"use client";

import { useEffect, useState } from "react";
import AccessControl from "@/components/admin/AccessControl";
import PageContainer from "@/components/admin/PageContainer";
import PageHeader from "@/components/admin/PageHeader";

type Sub = {
  id: string;
  vendor_public_id: string;
  status: string;
  legal_name: string | null;
  payouts_frozen: boolean;
};

export default function AdminCompliancePage() {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [audit, setAudit] = useState<
    { action: string; resource_id: string | null; created_at: string }[]
  >([]);
  const [vendorPublicId, setVendorPublicId] = useState("");

  const load = () =>
    void fetch("/api/admin/compliance")
      .then((r) => r.json())
      .then((j) => {
        setSubs(j.data?.submissions || []);
        setAudit(j.data?.audit || []);
      });

  useEffect(() => {
    load();
  }, []);

  const review = async (id: string, status: string) => {
    await fetch("/api/admin/compliance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "review", id, status }),
    });
    load();
  };

  const freeze = async (frozen: boolean) => {
    await fetch("/api/admin/compliance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "freeze_payouts",
        vendorPublicId,
        frozen,
      }),
    });
    load();
  };

  return (
    <AccessControl
      allowedRoles={["super_admin", "platform_admin", "compliance_officer"]}
      requiredPermission="compliance:kyc_review"
    >
      <PageContainer>
        <PageHeader
          title="KYC & Compliance"
          description="Review vendor identity, freeze payouts, and view append-only audit events."
        />
        <div className="mt-8 flex flex-col gap-3 border border-black/10 bg-white p-6 sm:flex-row">
          <input
            className="flex-1 border-b border-black/15 py-2 outline-none"
            placeholder="Vendor public id to freeze/unfreeze"
            value={vendorPublicId}
            onChange={(e) => setVendorPublicId(e.target.value)}
          />
          <button
            type="button"
            className="bg-black px-4 py-2 text-[12px] uppercase tracking-wider text-white"
            onClick={() => void freeze(true)}
          >
            Freeze payouts
          </button>
          <button
            type="button"
            className="border border-black px-4 py-2 text-[12px] uppercase tracking-wider"
            onClick={() => void freeze(false)}
          >
            Unfreeze
          </button>
        </div>
        <div className="mt-6 border border-black/10 bg-white">
          {subs.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.06] px-4 py-3 text-[13px]"
            >
              <div>
                <p className="font-medium">
                  {s.legal_name || s.vendor_public_id}
                </p>
                <p className="text-black/40">
                  {s.status}
                  {s.payouts_frozen ? " · payouts frozen" : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="underline"
                  onClick={() => void review(s.id, "approved")}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="underline"
                  onClick={() => void review(s.id, "rejected")}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
          {!subs.length ? (
            <p className="px-4 py-8 text-center text-black/40">
              No KYC submissions
            </p>
          ) : null}
        </div>
        <div className="mt-6 border border-black/10 bg-white">
          <p className="border-b border-black/10 px-4 py-3 text-[11px] uppercase tracking-[0.14em] text-black/40">
            Audit log
          </p>
          {audit.map((a, i) => (
            <div
              key={i}
              className="flex justify-between border-b border-black/[0.06] px-4 py-2 text-[12px]"
            >
              <span>{a.action}</span>
              <span className="text-black/40">{a.resource_id}</span>
              <span className="text-black/35">
                {a.created_at?.slice(0, 19)}
              </span>
            </div>
          ))}
        </div>
      </PageContainer>
    </AccessControl>
  );
}
