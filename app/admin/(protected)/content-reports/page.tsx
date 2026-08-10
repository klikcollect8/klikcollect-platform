"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageContainer, {
  AdminPageHeader,
} from "@/components/admin/PageContainer";
import AccessControl from "@/components/admin/AccessControl";
import SectionCard from "@/components/admin/SectionCard";

type Report = {
  public_id: string;
  vendor_public_id: string;
  target_type: string;
  target_id: string;
  reason: string;
  message: string;
  status: string;
  created_at: string;
};

const REASON_LABELS: Record<string, string> = {
  inappropriate: "Inappropriate",
  spam: "Spam",
  inaccurate: "Inaccurate",
  abuse: "Abuse",
  vendor_flag: "Vendor flag",
  other: "Other",
};

function ContentReportsContent() {
  const [rows, setRows] = useState<Report[]>([]);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("open");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    const q = filter ? `?status=${encodeURIComponent(filter)}` : "";
    const res = await fetch(`/api/admin/content-reports${q}`);
    const json = await res.json();
    if (res.ok) setRows(json.data || []);
    else setError(json.error?.message || "Failed to load reports");
  };

  useEffect(() => {
    void load();
  }, [filter]);

  const patch = async (
    publicId: string,
    status: string,
    hideReview = false,
  ) => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/content-reports", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicId, status, hideReview }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error?.message || "Update failed");
      return;
    }
    void load();
  };

  return (
    <PageContainer>
      <AdminPageHeader
        title="Content reports"
        description="Vendor-flagged reviews and questions awaiting platform moderation."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {["open", "in_review", "resolved", "dismissed"].map((s) => (
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

      {error ? (
        <p className="mb-4 text-[13px] text-[#8e1b0d]">{error}</p>
      ) : null}

      <SectionCard title={`${rows.length} reports`}>
        <div className="divide-y divide-black/10">
          {rows.map((r) => {
            const adminHref =
              r.target_type === "review"
                ? `/admin/reviews`
                : `/admin/questions`;
            return (
              <div
                key={r.public_id}
                className="flex flex-col gap-2 py-4 sm:flex-row sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-[14px] font-medium capitalize">
                    {r.target_type} ·{" "}
                    {REASON_LABELS[r.reason] || r.reason.replace(/_/g, " ")}
                  </p>
                  <p className="mt-1 text-[13px] text-black/70">
                    {r.message || "No message"}
                  </p>
                  <p className="mt-1 text-[12px] text-black/45">
                    Vendor{" "}
                    <Link
                      href={`/admin/vendors`}
                      className="underline"
                      title={r.vendor_public_id}
                    >
                      {r.vendor_public_id.slice(0, 16)}
                      {r.vendor_public_id.length > 16 ? "…" : ""}
                    </Link>{" "}
                    ·{" "}
                    <Link href={adminHref} className="underline">
                      Open {r.target_type}s
                    </Link>{" "}
                    · id {r.target_id.slice(0, 12)}
                    {r.target_id.length > 12 ? "…" : ""} ·{" "}
                    {new Date(r.created_at).toLocaleString("en-KE")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void patch(r.public_id, "in_review")}
                    className="border border-black/15 px-3 py-1.5 text-[11px] uppercase tracking-wide disabled:opacity-40"
                  >
                    Review
                  </button>
                  {r.target_type === "review" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void patch(r.public_id, "resolved", true)}
                      className="bg-black px-3 py-1.5 text-[11px] uppercase tracking-wide text-white disabled:opacity-40"
                    >
                      Resolve + hide
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void patch(r.public_id, "resolved", false)}
                      className="bg-black px-3 py-1.5 text-[11px] uppercase tracking-wide text-white disabled:opacity-40"
                    >
                      Resolve
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void patch(r.public_id, "dismissed")}
                    className="border border-black/15 px-3 py-1.5 text-[11px] uppercase tracking-wide disabled:opacity-40"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            );
          })}
          {!rows.length ? (
            <p className="py-8 text-center text-[13px] text-black/40">
              No reports in this queue
            </p>
          ) : null}
        </div>
      </SectionCard>
    </PageContainer>
  );
}

export default function ContentReportsPage() {
  return (
    <AccessControl requiredPermission="content:moderate">
      <ContentReportsContent />
    </AccessControl>
  );
}
