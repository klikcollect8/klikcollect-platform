"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ADMISSION_CRITERIA,
  REJECTION_CLASSES,
  type CurationApplication,
  type AdmissionCriterionId,
  type RejectionClassId,
} from "@/lib/curation-policy";
import { track } from "@/lib/track";
import { StatusBadge } from "@/components/os/StatusBadge";

type Payload = {
  applications: CurationApplication[];
};

export function CurationClient() {
  const [apps, setApps] = useState<CurationApplication[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [criteria, setCriteria] = useState<AdmissionCriterionId[]>([]);
  const [rejectionClasses, setRejectionClasses] = useState<RejectionClassId[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/curation");
    const json = await res.json();
    const data = json.data as Payload;
    setApps(data.applications || []);
    if (!selected && data.applications?.[0]) {
      setSelected(data.applications[0].id);
    }
  }, [selected]);

  useEffect(() => {
    void load();
    track("os.curation_viewed", {}, "admin");
  }, [load]);

  const current = apps.find((a) => a.id === selected) || null;
  const pending = apps.filter((a) => a.status === "pending");
  const decided = apps.filter((a) => a.status !== "pending");

  async function decide(outcome: "admitted" | "rejected") {
    if (!current) return;
    if (!reason.trim()) {
      setMessage("Record a reason — decisions must be auditable (who / when / why).");
      return;
    }
    if (outcome === "rejected" && rejectionClasses.length === 0) {
      setMessage("Select at least one rejection class from Chapter 01.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/curation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: current.id,
          outcome,
          reason,
          criteriaChecked: criteria,
          rejectionClasses: outcome === "rejected" ? rejectionClasses : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json?.error?.message || "Decision failed");
        return;
      }
      setReason("");
      setCriteria([]);
      setRejectionClasses([]);
      await load();
      setMessage(outcome === "admitted" ? "Vendor admitted." : "Vendor rejected — recorded.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-white">
          <div className="border-b border-[var(--kc-line-soft)] px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--kc-faint)]">
            Queue ({pending.length})
          </div>
          <div className="space-y-0.5 p-2">
            {apps.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelected(a.id)}
                className={`w-full rounded-[var(--kc-radius-sm)] px-3 py-2.5 text-left transition-colors ${
                  selected === a.id
                    ? "bg-[var(--kc-canvas)]"
                    : "hover:bg-[var(--kc-canvas)]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-medium text-[var(--kc-ink)]">
                    {a.businessName}
                  </span>
                  <StatusBadge status={a.status} />
                </div>
                <div className="mt-0.5 text-[12px] text-[var(--kc-faint)]">{a.neighbourhood}</div>
              </button>
            ))}
            {!apps.length ? (
              <p className="px-2 py-6 text-sm text-neutral-500">
                No applications yet.
              </p>
            ) : null}
          </div>
        </aside>

        <div className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-white p-5 sm:p-6">
          {!current ? (
            <p className="text-sm text-neutral-500">Select an application</p>
          ) : (
            <div className="space-y-6">
              <div>
                <p className="text-xs text-neutral-400">{current.id}</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-neutral-900">
                  {current.businessName}
                </h2>
                <p className="mt-1 text-sm text-neutral-500">
                  {current.neighbourhood} · {current.contactEmail}
                  {current.contactPhone ? ` · ${current.contactPhone}` : ""}
                </p>
                {current.categories?.length ? (
                  <p className="mt-1 text-sm text-neutral-500">
                    {current.categories.join(" · ")}
                  </p>
                ) : null}
                {current.notes ? (
                  <p className="mt-3 text-sm text-neutral-600">{current.notes}</p>
                ) : null}
              </div>

              {current.status === "pending" ? (
                <>
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                      Admission criteria
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {ADMISSION_CRITERIA.map((c) => {
                        const on = criteria.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() =>
                              setCriteria((prev) =>
                                on ? prev.filter((x) => x !== c.id) : [...prev, c.id],
                              )
                            }
                            className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                              on
                                ? "border-neutral-900 bg-neutral-900 text-white"
                                : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                            }`}
                          >
                            {c.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                      Rejection classes
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {REJECTION_CLASSES.map((r) => {
                        const on = rejectionClasses.includes(r.id);
                        return (
                          <button
                            key={r.id}
                            type="button"
                            title={r.nature}
                            onClick={() =>
                              setRejectionClasses((prev) =>
                                on ? prev.filter((x) => x !== r.id) : [...prev, r.id],
                              )
                            }
                            className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                              on
                                ? "border-neutral-900 bg-neutral-900 text-white"
                                : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                            }`}
                          >
                            {r.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-500">
                      Decision reason
                    </label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                      placeholder="Why admit or reject — recorded for audit"
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-neutral-900"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void decide("admitted")}
                      className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      Admit vendor
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void decide("rejected")}
                      className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Decision recorded
                  </p>
                  <p className="mt-1 text-lg font-semibold capitalize">{current.status}</p>
                  <p className="mt-2 text-sm text-neutral-600">{current.decision?.reason}</p>
                  <p className="mt-2 text-xs text-neutral-400">
                    {current.decision?.decidedBy} · {current.decision?.decidedAt}
                  </p>
                </div>
              )}

              {message ? (
                <p className="rounded-lg bg-neutral-50 px-3 py-2.5 text-sm font-medium text-neutral-700">
                  {message}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {decided.length ? (
        <div className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-white">
          <div className="border-b border-[var(--kc-line-soft)] px-4 py-3 text-[13px] font-semibold text-[var(--kc-ink)]">
            Audit trail ({decided.length})
          </div>
          <div className="divide-y divide-[var(--kc-line-soft)]">
            {decided.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center gap-2 px-4 py-3 text-[13px] text-[var(--kc-mute)]"
              >
                <span className="font-medium text-[var(--kc-ink)]">{a.businessName}</span>
                <StatusBadge status={a.status} />
                <span className="text-[12px] text-[var(--kc-faint)]">
                  {a.decision?.decidedBy}
                  {a.decision?.decidedAt
                    ? ` · ${new Date(a.decision.decidedAt).toLocaleDateString("en-KE")}`
                    : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
