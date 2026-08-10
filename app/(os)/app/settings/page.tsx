import Link from "next/link";
import { ModuleShell } from "@/components/os/ModuleShell";
import { messages } from "@/messages/en-KE";
import { osUi } from "@/components/os/os-ui";
import { cn } from "@/lib/utils";

const LINKS = [
  {
    href: "/app/store",
    label: "Storefront",
    desc: "Name, story, hours, and public store profile",
  },
  {
    href: "/app/finance",
    label: "Balance & payouts",
    desc: "Paystack wallet, settlements, receipts, and withdrawals",
  },
  {
    href: "/app/staff",
    label: "Staff",
    desc: "Invite owners, managers, cashiers, dispatch, and drivers",
  },
  {
    href: "/app/kyc",
    label: "KYC / compliance",
    desc: "Verification status for payouts",
  },
] as const;

export default function OsSettingsPage() {
  return (
    <ModuleShell
      title={messages.os.settings}
      description="Shortcuts into live workspace settings. Nothing here is a fake toggle."
      live
    >
      <p className={cn("mb-6 text-[14px]", osUi.muted)}>
        Branding and opening hours live on Store. Money and team live on Wallet
        and Staff.
      </p>

      <div className="divide-y divide-black/10 border-t border-black/10">
        {LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col gap-0.5 py-4 transition-colors hover:bg-black/[0.02] sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
          >
            <span className="text-[15px] font-medium text-black">
              {item.label}
            </span>
            <span className={cn("text-[13px] sm:text-right", osUi.muted)}>
              {item.desc}
            </span>
          </Link>
        ))}
      </div>

      <p className={cn("mt-8 text-[12px]", osUi.muted)}>
        Market · Nairobi · KES · en-KE · Paystack (card + M-Pesa)
      </p>
    </ModuleShell>
  );
}
