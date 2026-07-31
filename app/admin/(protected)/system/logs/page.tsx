import { format } from 'date-fns';
import PageContainer from '@/components/admin/PageContainer';
import PageHeader from '@/components/admin/PageHeader';
import SectionCard from '@/components/admin/SectionCard';
import AccessControl from '@/components/admin/AccessControl';
import { recentUsageEvents, type UsageEvent } from '@/lib/m1-store';

function LogsList({ events }: { events: UsageEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg bg-[var(--kc-canvas)] p-6 text-center text-sm text-neutral-500">
        No tracked events yet. Client activity is appended to{' '}
        <code className="text-xs">.data/usage-events.jsonl</code> when the events API runs.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-100 text-xs uppercase tracking-wide text-neutral-500">
            <th className="pb-3 pr-4 font-medium">Time</th>
            <th className="pb-3 pr-4 font-medium">Event</th>
            <th className="pb-3 pr-4 font-medium">Actor</th>
            <th className="pb-3 font-medium">Properties</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-50">
          {events.map((ev) => (
            <tr key={ev.id} className="text-[var(--kc-ink)]">
              <td className="py-3 pr-4 whitespace-nowrap text-neutral-500">
                {format(new Date(ev.createdAt), 'PP pp')}
              </td>
              <td className="py-3 pr-4 font-medium">{ev.name}</td>
              <td className="py-3 pr-4 capitalize text-neutral-600">{ev.actorType ?? '—'}</td>
              <td className="py-3 font-mono text-xs text-neutral-600 max-w-md truncate">
                {ev.properties ? JSON.stringify(ev.properties) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function SystemLogsPage() {
  const events = await recentUsageEvents(100);

  return (
    <AccessControl allowedRoles={['head_admin', 'admin']}>
      <PageContainer>
        <PageHeader
          title="Activity logs"
          description="Recent usage events from local .data tracking (newest first)."
        />
        <SectionCard title={`Recent events (${events.length})`}>
          <LogsList events={events} />
        </SectionCard>
      </PageContainer>
    </AccessControl>
  );
}
