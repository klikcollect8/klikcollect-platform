"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ChevronLeft, LifeBuoy, RefreshCw, X } from "lucide-react";
import PageContainer from "@/components/admin/PageContainer";
import PageHeader from "@/components/admin/PageHeader";
import SectionCard from "@/components/admin/SectionCard";
import AccessControl from "@/components/admin/AccessControl";
import { useToast } from "@/components/ToastProvider";

type TicketStatus = "open" | "in_progress" | "resolved";

type SupportTicket = {
  id: string;
  type: "ticket" | "dispute";
  subject: string;
  body: string;
  status: TicketStatus;
  requesterEmail: string;
  orderId?: string;
  createdAt: string;
  updatedAt: string;
  notes: string[];
};

const statusLabel: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
};

const btnPrimary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--kc-ink)] px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50 transition-colors";
const btnSecondary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-[var(--kc-ink)] hover:bg-neutral-50 disabled:opacity-50 transition-colors";

function SupportTicketsContent() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | TicketStatus>("open");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState("");
  const { showToast } = useToast();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/support/tickets?type=ticket");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setTickets(data);
    } catch {
      showToast("Could not load support tickets", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const patchTicket = async (
    id: string,
    payload: { status?: TicketStatus; note?: string },
  ) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/support/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Update failed");
      const updated = (await res.json()) as SupportTicket;
      setTickets((prev) => prev.map((t) => (t.id === id ? updated : t)));
      showToast("Ticket updated", "success");
    } catch {
      showToast("Could not update ticket", "error");
    } finally {
      setBusyId(null);
    }
  };

  const openCount = tickets.filter((t) => t.status === "open").length;
  const inProgressCount = tickets.filter(
    (t) => t.status === "in_progress",
  ).length;
  const visibleTickets = useMemo(
    () =>
      statusFilter === "all"
        ? tickets
        : tickets.filter((ticket) => ticket.status === statusFilter),
    [statusFilter, tickets],
  );
  const selectedTicket =
    tickets.find((ticket) => ticket.id === selectedId) || null;

  useEffect(() => {
    if (!selectedTicket) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedTicket]);

  return (
    <PageContainer>
      <PageHeader
        title="Support tickets"
        description="Customer support queue - oldest open tickets first."
        badge={
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-medium text-[var(--kc-ink)] border border-neutral-200">
            <LifeBuoy className="h-3.5 w-3.5" />
            {openCount} open · {inProgressCount} in progress
          </span>
        }
        action={
          <button
            type="button"
            className={btnSecondary}
            onClick={() => void load()}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        }
      />

      <SectionCard title="Queue">
        <div
          className="mb-3 flex gap-1 overflow-x-auto pb-1"
          role="group"
          aria-label="Filter tickets by status"
        >
          {(
            [
              ["open", "Open", openCount],
              ["in_progress", "In progress", inProgressCount],
              [
                "resolved",
                "Resolved",
                tickets.filter((ticket) => ticket.status === "resolved").length,
              ],
              ["all", "All", tickets.length],
            ] as const
          ).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              aria-pressed={statusFilter === value}
              className={`min-h-11 shrink-0 rounded-lg px-3 text-[12px] font-medium transition-colors ${
                statusFilter === value
                  ? "bg-[var(--kc-ink)] text-white"
                  : "bg-[var(--kc-canvas)] text-[var(--kc-mute)] hover:text-[var(--kc-ink)]"
              }`}
            >
              {label} <span className="tabular-nums opacity-70">{count}</span>
            </button>
          ))}
        </div>
        {loading ? (
          <p className="text-sm text-neutral-500">Loading tickets…</p>
        ) : tickets.length === 0 ? (
          <p className="text-sm text-neutral-500">No support tickets yet.</p>
        ) : visibleTickets.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-500">
            No {statusLabel[statusFilter as TicketStatus]?.toLowerCase()} tickets.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {visibleTickets.map((ticket) => (
              <li key={ticket.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(ticket.id);
                    setDraftNote("");
                  }}
                  className="flex min-h-16 w-full items-center gap-3 py-3 text-left transition-colors hover:bg-black/[0.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  aria-label={`Open ticket: ${ticket.subject}, ${statusLabel[ticket.status]}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-[14px] font-semibold text-[var(--kc-ink)]">
                        {ticket.subject}
                      </h3>
                      <span
                        className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ${
                          ticket.status === "resolved"
                            ? "bg-neutral-100 text-neutral-600"
                            : "bg-black/[0.04] text-black/70"
                        }`}
                      >
                        {statusLabel[ticket.status]}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[12px] text-neutral-500">
                      {ticket.requesterEmail} ·{" "}
                      {format(new Date(ticket.createdAt), "PP")}
                    </p>
                  </div>
                  <span className="shrink-0 text-[12px] text-neutral-400">
                    View
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {selectedTicket ? (
        <div
          className="fixed inset-0 z-50 bg-black/15 sm:flex sm:justify-end"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedId(null);
          }}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="support-ticket-title"
            className="relative flex h-full w-full flex-col bg-white shadow-2xl sm:max-w-xl sm:border-l sm:border-neutral-200"
          >
            <header className="flex min-h-16 items-center gap-2 border-b border-neutral-200 px-3 sm:px-5">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-neutral-100 sm:hidden"
                aria-label="Back to ticket queue"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                  Ticket inspector
                </p>
                <h2
                  id="support-ticket-title"
                  className="truncate text-[15px] font-semibold text-[var(--kc-ink)]"
                >
                  {selectedTicket.subject}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="hidden min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-neutral-100 sm:inline-flex"
                aria-label="Close ticket inspector"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </header>

            <div className="flex-1 space-y-6 overflow-y-auto p-4 pb-28 sm:p-6 sm:pb-28">
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-md bg-[var(--kc-canvas)] px-2.5 py-1 text-xs font-medium text-[var(--kc-ink)]">
                  {statusLabel[selectedTicket.status]}
                </span>
                <span className="text-xs text-neutral-400">
                  Updated {format(new Date(selectedTicket.updatedAt), "PPp")}
                </span>
              </div>

              <section aria-labelledby="ticket-message-heading">
                <h3
                  id="ticket-message-heading"
                  className="text-xs font-semibold uppercase tracking-wider text-neutral-400"
                >
                  Message
                </h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-700">
                  {selectedTicket.body}
                </p>
              </section>

              <section aria-labelledby="ticket-metadata-heading">
                <h3
                  id="ticket-metadata-heading"
                  className="text-xs font-semibold uppercase tracking-wider text-neutral-400"
                >
                  Metadata
                </h3>
                <dl className="mt-2 divide-y divide-neutral-100 rounded-lg border border-neutral-200 text-xs">
                  {[
                    ["Requester", selectedTicket.requesterEmail],
                    ["Order", selectedTicket.orderId || "Not linked"],
                    ["Created", format(new Date(selectedTicket.createdAt), "PPp")],
                    ["Ticket ID", selectedTicket.id],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="grid grid-cols-[88px_1fr] gap-3 px-3 py-2.5"
                    >
                      <dt className="text-neutral-400">{label}</dt>
                      <dd className="break-all font-medium text-neutral-700">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>

              <section aria-labelledby="ticket-notes-heading">
                <h3
                  id="ticket-notes-heading"
                  className="text-xs font-semibold uppercase tracking-wider text-neutral-400"
                >
                  Internal notes
                </h3>
                {selectedTicket.notes.length ? (
                  <ul className="mt-2 space-y-2">
                    {selectedTicket.notes.map((note, index) => (
                      <li
                        key={`${selectedTicket.id}-note-${index}`}
                        className="rounded-lg bg-[var(--kc-canvas)] px-3 py-2.5 text-xs leading-5 text-neutral-600"
                      >
                        {note}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-neutral-400">No notes yet.</p>
                )}
                <label
                  htmlFor="support-note"
                  className="mt-3 block text-xs font-medium text-neutral-600"
                >
                  Add a note
                </label>
                <textarea
                  id="support-note"
                  value={draftNote}
                  onChange={(event) => setDraftNote(event.target.value)}
                  rows={3}
                  placeholder="Visible to support staff only"
                  className="mt-1.5 w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-neutral-900"
                />
                <button
                  type="button"
                  className={`${btnSecondary} mt-2`}
                  disabled={!draftNote.trim() || busyId === selectedTicket.id}
                  onClick={() => {
                    void patchTicket(selectedTicket.id, {
                      note: draftNote.trim(),
                    });
                    setDraftNote("");
                  }}
                >
                  Save note
                </button>
              </section>
            </div>

            {selectedTicket.status !== "resolved" ? (
              <footer className="absolute inset-x-0 bottom-0 grid grid-cols-2 gap-2 border-t border-neutral-200 bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur sm:px-6">
                {selectedTicket.status === "open" ? (
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={busyId === selectedTicket.id}
                    onClick={() =>
                      void patchTicket(selectedTicket.id, {
                        status: "in_progress",
                        note: "Escalated to in progress",
                      })
                    }
                  >
                    Escalate
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={busyId === selectedTicket.id}
                  onClick={() =>
                    void patchTicket(selectedTicket.id, {
                      status: "resolved",
                      note: "Marked resolved from admin queue",
                    })
                  }
                >
                  Resolve
                </button>
              </footer>
            ) : null}
          </aside>
        </div>
      ) : null}
    </PageContainer>
  );
}

export default function SupportPage() {
  return (
    <AccessControl requiredPermission="support:tickets_view">
      <SupportTicketsContent />
    </AccessControl>
  );
}
