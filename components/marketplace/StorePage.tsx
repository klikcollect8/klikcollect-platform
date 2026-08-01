import { cn } from "@/lib/utils";

/** Shared spacious storefront page shell */
export function StorePage({
  children,
  className,
  narrow,
}: {
  children: React.ReactNode;
  className?: string;
  narrow?: boolean;
}) {
  return (
    <div className={cn("min-h-screen w-full bg-[#f7f7f5] text-black", className)}>
      <div
        className={cn(
          "mx-auto w-full px-4 py-10 sm:px-10 sm:py-16 lg:px-14 xl:px-20",
          narrow ? "max-w-[960px]" : "max-w-[1600px]",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function StoreHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-12 flex flex-col gap-6 sm:mb-16 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="mb-3 text-[12px] font-medium uppercase tracking-[0.24em] text-black/40">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-[clamp(2rem,4vw,3.25rem)] font-medium leading-[1.05] tracking-[-0.03em]">
          {title}
        </h1>
        {description ? (
          <p className="mt-4 max-w-lg text-[16px] leading-relaxed text-black/50">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
