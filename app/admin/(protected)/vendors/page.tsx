import Link from "next/link";
import { listApplications } from "@/lib/m1-store";
import { StatusBadge } from "@/components/os/StatusBadge";

export const dynamic = "force-dynamic";

export default async function AdminVendorsPage() {
  const apps = await listApplications();
  const pending = apps.filter((a) => a.status === "pending");
  const admitted = apps.filter((a) => a.status === "admitted");
  const rejected = apps.filter((a) => a.status === "rejected");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[var(--kc-ink)]">
            Vendors
          </h1>
          <p className="mt-1 text-[13px] text-[var(--kc-mute)]">
            Admit or reject applicants with a recorded reason. Full decision UI
            lives in Commerce OS Curation.
          </p>
        </div>
        <Link
          href="/app/curation"
          className="rounded-[var(--kc-radius-sm)] bg-[var(--kc-ink)] px-3.5 py-2 text-[13px] font-medium text-white hover:bg-black"
        >
          Open curation queue
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Pending" value={pending.length} />
        <Stat label="Admitted" value={admitted.length} />
        <Stat label="Rejected" value={rejected.length} />
      </div>

      <div className="overflow-hidden rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-white">
        <div className="border-b border-[var(--kc-line-soft)] px-4 py-3 text-[13px] font-semibold">
          All applications
        </div>
        <div className="divide-y divide-[var(--kc-line-soft)]">
          {apps.map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-[var(--kc-ink)]">
                  {a.businessName}
                </p>
                <p className="text-[12px] text-[var(--kc-faint)]">
                  {a.neighbourhood} · {a.contactEmail}
                </p>
              </div>
              <StatusBadge
                status={
                  a.status === "admitted"
                    ? "active"
                    : a.status === "pending"
                      ? "pending"
                      : "cancelled"
                }
                label={a.status}
              />
            </div>
          ))}
          {!apps.length ? (
            <p className="px-4 py-10 text-center text-[13px] text-[var(--kc-faint)]">
              No vendor applications yet.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-white px-4 py-3">
      <p className="text-[12px] text-[var(--kc-faint)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--kc-ink)]">
        {value}
      </p>
    </div>
  );
}
