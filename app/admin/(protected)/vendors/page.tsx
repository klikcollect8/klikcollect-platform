import Link from "next/link";
import { listApplications } from "@/lib/m1-store";
import { StatusBadge } from "@/components/os/StatusBadge";
import { CurationClient } from "@/app/(os)/app/curation/CurationClient";

export const dynamic = "force-dynamic";

export default async function AdminVendorsPage() {
  const apps = await listApplications();
  const pending = apps.filter((a) => a.status === "pending");
  const admitted = apps.filter((a) => a.status === "admitted");
  const rejected = apps.filter((a) => a.status === "rejected");

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[var(--kc-ink)]">
            Vendors
          </h1>
          <p className="mt-1 text-[13px] text-[var(--kc-mute)]">
            Admit or reject applicants with a recorded reason. Admission creates
            the vendor account, storefront, and owner membership.
          </p>
        </div>
        <Link
          href="#curation-queue"
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--kc-radius-sm)] bg-[var(--kc-ink)] px-3.5 py-2 text-[13px] font-medium text-white hover:bg-black"
        >
          Jump to queue
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat label="Pending" value={pending.length} />
        <Stat label="Admitted" value={admitted.length} />
        <Stat label="Rejected" value={rejected.length} />
      </div>

      <div id="curation-queue" className="scroll-mt-6">
        <h2 className="mb-3 text-[15px] font-semibold text-[var(--kc-ink)]">
          Curation queue
        </h2>
        <CurationClient />
      </div>

      <details className="group overflow-hidden rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-white">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-3 text-[13px] font-semibold [&::-webkit-details-marker]:hidden">
          All applications
          <span className="text-[11px] font-normal text-[var(--kc-faint)] group-open:hidden">
            Show
          </span>
          <span className="hidden text-[11px] font-normal text-[var(--kc-faint)] group-open:inline">
            Hide
          </span>
        </summary>
        <div className="divide-y divide-[var(--kc-line-soft)] border-t border-[var(--kc-line-soft)]">
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
      </details>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-white px-3 py-3 sm:px-4">
      <p className="text-[12px] text-[var(--kc-faint)]">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--kc-ink)] sm:text-2xl">
        {value}
      </p>
    </div>
  );
}
