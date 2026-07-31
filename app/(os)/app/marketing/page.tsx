import Link from "next/link";
import { ModuleShell } from "@/components/os/ModuleShell";

export default function MarketingDeferredPage() {
  return (
    <ModuleShell
      title="Marketing"
      description="Promotions and campaigns ship after M1 ops depth."
    >
      <div className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-white px-5 py-10 text-center">
        <p className="text-[14px] text-[var(--kc-mute)]">
          Not in primary nav. Toggle later from Admin → System → Feature flags.
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
