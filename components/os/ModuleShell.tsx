import Link from "next/link";
import { messages } from "@/messages/en-KE";
import { ui } from "@/components/system/tokens";

export function ModuleShell({
  title,
  description,
  live = false,
  actions,
  children,
}: {
  title: string;
  description: string;
  live?: boolean;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 max-w-2xl">
          <div className="mb-2 flex flex-wrap items-center gap-2.5">
            <p className={ui.pageEyebrow}>Vendor OS</p>
            <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-black/30">
              {live ? "Live" : "Soon"}
            </span>
          </div>
          <h1
            className={ui.pageTitle}
            style={{ fontFamily: "var(--font-display), sans-serif" }}
          >
            {title}
          </h1>
          <p className={`mt-2 max-w-lg ${ui.pageDesc}`}>{description}</p>
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </header>

      <div className="w-full">
        {children ?? (
          <div className="py-16 text-center">
            <p className="mx-auto max-w-md text-[14px] text-black/40">
              {messages.os.comingSoon}
            </p>
            <div className="mt-6">
              <Link href="/app" className={ui.btnSecondary}>
                Back to overview
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
