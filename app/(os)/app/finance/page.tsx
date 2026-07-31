import Link from "next/link";
import { ModuleShell } from "@/components/os/ModuleShell";

export default function FinanceDeferredPage() {
  return (
    <ModuleShell
      title="Finance"
      description="Payouts land with M3 money rails — not in primary nav yet."
    >
      <div className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-white px-5 py-10 text-center">
        <p className="text-[14px] text-[var(--kc-mute)]">
          Feature-flagged for later. Use Orders and Analytics for operational work today.
        </p>
        <Link
          href="/app"
          className="mt-4 inline-flex text-[13px] font-medium text-[var(--kc-ink)] underline underline-offset-4"
        >
          Back to Home
        </Link>
      </div>
    </ModuleShell>
  );
}
