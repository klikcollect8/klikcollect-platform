import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { osUi } from "@/components/os/os-ui";

/** Seamless surface - blends into canvas (homepage language) */
export function OsPanel({
  children,
  className,
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return <div className={cn(padded && "py-2", className)}>{children}</div>;
}

export function OsPanelHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-center justify-between gap-4">
      <span className={osUi.sectionLabel}>{title}</span>
      {action}
    </div>
  );
}

export function OsStat({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  delta,
  deltaPositive,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "warn" | "good";
  delta?: string;
  deltaPositive?: boolean;
}) {
  return (
    <div className="py-1">
      <div className="flex items-center justify-between gap-2">
        <p className={osUi.sectionLabel}>{label}</p>
        {Icon ? (
          <Icon className="h-3.5 w-3.5 text-black/25" strokeWidth={1.5} />
        ) : null}
      </div>
      <p
        className={cn(
          "mt-2 text-[26px] font-medium leading-none tracking-tight tabular-nums",
          tone === "warn" && "text-black/70",
          tone === "good" && "text-black",
          tone === "default" && "text-black",
        )}
        style={{ fontFamily: "var(--font-display), sans-serif" }}
      >
        {value}
      </p>
      {delta ? (
        <p
          className={cn(
            "mt-2 text-[13px]",
            deltaPositive === false ? "text-black/40" : "text-black/55",
          )}
        >
          {delta}
          {hint ? <span className="ml-1 text-black/35">{hint}</span> : null}
        </p>
      ) : hint ? (
        <p className="mt-2 text-[13px] text-black/40">{hint}</p>
      ) : null}
    </div>
  );
}

export function OsEmpty({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="py-16 text-center">
      <h3 className="text-[18px] font-medium tracking-tight text-black">
        {title}
      </h3>
      {body ? (
        <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-black/40">
          {body}
        </p>
      ) : null}
      {action ? (
        <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div>
      ) : null}
    </div>
  );
}

export function OsSectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-[17px] font-medium tracking-tight text-black">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-0.5 text-[13px] text-black/40">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
