import Link from "next/link";
import { ModuleShell } from "@/components/os/ModuleShell";
import { OsPanel, OsStat } from "@/components/os/OsPanel";
import { messages } from "@/messages/en-KE";

export default function OsSettingsPage() {
  const rows = [
    { label: "Locale", value: "en-KE" },
    { label: "Currency", value: "KES" },
    { label: "Launch city", value: "Nairobi" },
    { label: "Auth", value: "Clerk" },
    { label: "Payments", value: "Paystack (card + M-Pesa)" },
    { label: "Delivery", value: "OS Delivery · /app/couriers" },
    { label: "Receipts", value: "POS print · store branding on Store" },
    { label: "Tax", value: "Kenya VAT - configure with your accountant" },
  ];

  return (
    <ModuleShell
      title={messages.os.settings}
      description="Workspace defaults. Profile and opening hours live on Store."
      live
      actions={
        <div className="flex flex-wrap gap-2">
          <Link
            href="/app/store"
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            Store profile
          </Link>
          <Link
            href="/app/finance"
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            Wallet
          </Link>
          <Link
            href="/app/staff"
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            Team
          </Link>
        </div>
      }
    >
      <p className="mb-6 text-[14px] text-neutral-500">
        Branding, story, and weekly hours are on{" "}
        <Link
          href="/app/store"
          className="font-medium text-neutral-900 underline"
        >
          Store
        </Link>
        . Payout KYC and freezes are reviewed by platform compliance - check
        Wallet if withdrawals are blocked.
      </p>

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
