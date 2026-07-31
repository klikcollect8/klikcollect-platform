import Link from "next/link";
import { ModuleShell } from "@/components/os/ModuleShell";

export default function AiDeferredPage() {
  return (
    <ModuleShell
      title="AI"
      description="Advanced AI is explicitly out of the current build track."
    >
      <div className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-white px-5 py-10 text-center">
        <p className="text-[14px] text-[var(--kc-mute)]">
          Keep operating Products, Orders, Inventory, and Curation without AI surface noise.
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