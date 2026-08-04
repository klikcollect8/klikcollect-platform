"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Scale, Plus } from "lucide-react";
import PageContainer from "@/components/admin/PageContainer";
import PageHeader from "@/components/admin/PageHeader";
import SectionCard from "@/components/admin/SectionCard";
import AccessControl from "@/components/admin/AccessControl";
import { useToast } from "@/components/ToastProvider";

type SupportTicket = {
  id: string;
  type: "ticket" | "dispute";
  subject: string;
  body: string;
  status: string;
  requesterEmail: string;
  orderId?: string;
  createdAt: string;
  notes: string[];
};

const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--kc-ink)] px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50 transition-colors";

function DisputesContent() {
  const [disputes, setDisputes] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    subject: "",
    body: "",
    requesterEmail: "",
    orderId: "",
  });
  const { showToast } = useToast();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/support/tickets?type=dispute");
      if (!res.ok) throw new Error("Failed");
      setDisputes(await res.json());
    } catch {
      showToast("Could not load disputes", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const createDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, type: "dispute" }),
      });
      if (!res.ok) throw new Error("Create failed");
      setForm({ subject: "", body: "", requesterEmail: "", orderId: "" });
      setShowForm(false);
      showToast("Dispute recorded", "success");
      await load();
    } catch {
      showToast("Could not create dispute", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Disputes"
        description="Order and payment disputes tracked alongside support."
        action={
          <button
            type="button"
            className={btnPrimary}
            onClick={() => setShowForm((v) => !v)}
          >
            <Plus className="h-4 w-4" />
            New dispute
          </button>
        }
      />

      {showForm && (
        <SectionCard title="Record dispute" className="mb-6">
          <form onSubmit={createDispute} className="space-y-4 max-w-xl">
            <label className="block text-sm">
              <span className="font-medium text-[var(--kc-ink)]">Subject</span>
              <input
                required
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-[var(--kc-ink)]">Details</span>
              <textarea
                required
                rows={4}
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-[var(--kc-ink)]">
                Requester email
              </span>
              <input
                required
                type="email"
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                value={form.requesterEmail}
                onChange={(e) =>
                  setForm({ ...form, requesterEmail: e.target.value })
                }
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-[var(--kc-ink)]">
                Order ID (optional)
              </span>
              <input
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                value={form.orderId}
                onChange={(e) => setForm({ ...form, orderId: e.target.value })}
              />
            </label>
            <button type="submit" className={btnPrimary} disabled={saving}>
              {saving ? "Saving…" : "Create dispute"}
            </button>
          </form>
        </SectionCard>
      )}

      <SectionCard title="Dispute list">
        {loading ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : disputes.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center text-neutral-500">
            <Scale className="mb-3 h-10 w-10 text-neutral-300" />
            <p className="text-sm">
              No disputes on file. Use &quot;New dispute&quot; to log one.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {disputes.map((d) => (
              <li key={d.id} className="py-4 first:pt-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-[var(--kc-ink)]">
                    {d.subject}
                  </h3>
                  <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs capitalize">
                    {d.status.replace("_", " ")}
                  </span>
                </div>
                <p className="mt-1 text-sm text-neutral-600">{d.body}</p>
                <p className="mt-2 text-xs text-neutral-500">
                  {d.requesterEmail}
                  {d.orderId ? ` · Order ${d.orderId}` : ""} ·{" "}
                  {format(new Date(d.createdAt), "PP")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </PageContainer>
  );
}

export default function DisputesPage() {
  return (
    <AccessControl requiredPermission="compliance:disputes">
      <DisputesContent />
    </AccessControl>
  );
}
