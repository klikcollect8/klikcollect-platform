'use client';

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { LifeBuoy, RefreshCw } from 'lucide-react';
import PageContainer from '@/components/admin/PageContainer';
import PageHeader from '@/components/admin/PageHeader';
import SectionCard from '@/components/admin/SectionCard';
import AccessControl from '@/components/admin/AccessControl';
import { useToast } from '@/components/ToastProvider';

type TicketStatus = 'open' | 'in_progress' | 'resolved';

type SupportTicket = {
  id: string;
  type: 'ticket' | 'dispute';
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
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
};

const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--kc-ink)] px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50 transition-colors';
const btnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-[var(--kc-ink)] hover:bg-neutral-50 disabled:opacity-50 transition-colors';

function SupportTicketsContent() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { showToast } = useToast();

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/support/tickets?type=ticket');
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setTickets(data);
    } catch {
      showToast('Could not load support tickets', 'error');
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
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Update failed');
      const updated = (await res.json()) as SupportTicket;
      setTickets((prev) => prev.map((t) => (t.id === id ? updated : t)));
      showToast('Ticket updated', 'success');
    } catch {
      showToast('Could not update ticket', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const openCount = tickets.filter((t) => t.status === 'open').length;
  const inProgressCount = tickets.filter((t) => t.status === 'in_progress').length;

  return (
    <PageContainer>
      <PageHeader
        title="Support tickets"
        description="Customer support queue — oldest open tickets first."
        badge={
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-medium text-[var(--kc-ink)] border border-neutral-200">
            <LifeBuoy className="h-3.5 w-3.5" />
            {openCount} open · {inProgressCount} in progress
          </span>
        }
        action={
          <button type="button" className={btnSecondary} onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        }
      />

      <SectionCard title="Queue">
        {loading ? (
          <p className="text-sm text-neutral-500">Loading tickets…</p>
        ) : tickets.length === 0 ? (
          <p className="text-sm text-neutral-500">No support tickets yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {tickets.map((ticket) => (
              <li key={ticket.id} className="py-5 first:pt-0 last:pb-0">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="text-base font-semibold text-[var(--kc-ink)]">{ticket.subject}</h3>
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                          ticket.status === 'resolved'
                            ? 'bg-neutral-100 text-neutral-600'
                            : ticket.status === 'in_progress'
                              ? 'bg-black/[0.04] text-black/60'
                              : 'bg-black/[0.04] text-black'
                        }`}
                      >
                        {statusLabel[ticket.status]}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-600 whitespace-pre-wrap">{ticket.body}</p>
                    <dl className="mt-3 grid gap-1 text-xs text-neutral-500 sm:grid-cols-2">
                      <div>
                        <span className="font-medium text-neutral-700">From:</span>{' '}
                        {ticket.requesterEmail}
                      </div>
                      {ticket.orderId && (
                        <div>
                          <span className="font-medium text-neutral-700">Order:</span>{' '}
                          {ticket.orderId}
                        </div>
                      )}
                      <div>
                        <span className="font-medium text-neutral-700">Created:</span>{' '}
                        {format(new Date(ticket.createdAt), 'PPp')}
                      </div>
                      <div>
                        <span className="font-medium text-neutral-700">ID:</span> {ticket.id}
                      </div>
                    </dl>
                    {ticket.notes.length > 0 && (
                      <div className="mt-3 rounded-lg bg-[var(--kc-canvas)] p-3">
                        <p className="text-xs font-semibold text-[var(--kc-ink)] mb-2">Internal notes</p>
                        <ul className="space-y-1 text-xs text-neutral-600">
                          {ticket.notes.map((note, i) => (
                            <li key={`${ticket.id}-note-${i}`}>• {note}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  {ticket.status !== 'resolved' && (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {ticket.status === 'open' && (
                        <button
                          type="button"
                          className={btnPrimary}
                          disabled={busyId === ticket.id}
                          onClick={() =>
                            void patchTicket(ticket.id, {
                              status: 'in_progress',
                              note: 'Escalated to in progress',
                            })
                          }
                        >
                          Escalate
                        </button>
                      )}
                      <button
                        type="button"
                        className={btnPrimary}
                        disabled={busyId === ticket.id}
                        onClick={() =>
                          void patchTicket(ticket.id, {
                            status: 'resolved',
                            note: 'Marked resolved from admin queue',
                          })
                        }
                      >
                        Resolve
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </PageContainer>
  );
}

export default function SupportPage() {
  return (
    <AccessControl allowedRoles={['head_admin', 'admin', 'moderator']}>
      <SupportTicketsContent />
    </AccessControl>
  );
}
