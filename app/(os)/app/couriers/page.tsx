import Link from "next/link";
import { ModuleShell } from "@/components/os/ModuleShell";

export default function CouriersDeferredPage() {
  return (
    <ModuleShell
      title="Couriers"
      description="Courier mobile is out of the current web track."
    >
      <div className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-white px-5 py-10 text-center">
        <p className="text-[14px] text-[var(--kc-mute)]">
          Click &amp; collect is the V1 fulfilment model. Courier ops stay deferred.
        </p>
        <Link
          href="/app/orders"
          className="mt-4 inline-flex text-[13px] font-medium text-[var(--kc-ink)] underline underline-offset-4"
        >
          Open orders
        </Link>
      </div>
    </ModuleShell>
  );
}
