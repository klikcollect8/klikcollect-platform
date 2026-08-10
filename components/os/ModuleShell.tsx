import Link from "next/link";
import { messages } from "@/messages/en-KE";
import { osUi } from "@/components/os/os-ui";
import { cn } from "@/lib/utils";

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
    <div className="w-full space-y-8 sm:space-y-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-5">
        <div className="min-w-0 max-w-2xl">
          <div className="mb-1.5 flex flex-wrap items-center gap-2 sm:mb-2 sm:gap-2.5">
            <p className={osUi.pageEyebrow}>Store</p>
            <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-black/30">
              {live ? "Live" : "Soon"}
            </span>
          </div>
          <h1
            className={cn(
              osUi.pageTitle,
              "text-[24px] sm:text-[28px] lg:text-[32px]",
            )}
            style={{ fontFamily: "var(--font-display), sans-serif" }}
          >
            {title}
          </h1>
          <p className={cn("mt-1.5 max-w-lg text-[14px] sm:mt-2 sm:text-[15px]", osUi.pageDesc)}>
            {description}
          </p>
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </header>

      <div className="w-full">
        {children ?? (
          <div className="py-16 text-center">
            <p className="mx-auto max-w-md text-[14px] text-black/40">
              {messages.os.comingSoon}
            </p>
            <div className="mt-6">
              <Link href="/app" className={osUi.btnSecondary}>
                Back to overview
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
