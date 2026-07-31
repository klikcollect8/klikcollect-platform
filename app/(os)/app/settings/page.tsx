import Link from "next/link";
import { ModuleShell } from "@/components/os/ModuleShell";
import { OsPanel, OsStat } from "@/components/os/OsPanel";
import { messages } from "@/messages/en-KE";
import { DEMO_VENDOR_ID } from "@/lib/tenancy";

export default function OsSettingsPage() {
  const rows = [
    { label: "Locale", value: "en-KE" },
    { label: "Currency", value: "KES" },
    { label: "Launch city", value: "Nairobi" },
    { label: "Auth", value: "Clerk" },
    { label: "Collect hubs", value: "Westlands · Kilimani · Karen" },
    { label: "Demo tenant", value: DEMO_VENDOR_ID },
    { label: "Payments", value: "M3 — PaymentProvider" },
    { label: "Delivery", value: "M4 — logistics" },
  ];

  return (
    <ModuleShell
      title={messages.os.settings}
      description="Workspace defaults for locale, currency, tenancy, and collect hubs."
      live
      actions={
        <Link
          href="/admin"
          className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium hover:bg-neutral-50"
        >
          Open admin
        </Link>
      }
    >
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OsStat label="Market" value="Nairobi" />
        <OsStat label="Currency" value="KES" />
        <OsStat label="Locale" value="en-KE" />
        <OsStat label="Identity" value="Clerk" />
      </div>

      <OsPanel padded={false}>
        <div className="divide-y divide-neutral-100">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm sm:px-5"
            >
              <span className="text-neutral-500">{row.label}</span>
              <span className="font-medium text-neutral-900">{row.value}</span>
            </div>
          ))}
        </div>
      </OsPanel>
    </ModuleShell>
  );
}
