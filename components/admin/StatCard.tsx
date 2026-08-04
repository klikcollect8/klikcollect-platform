"use client";

import { LucideIcon } from "lucide-react";
import Link from "next/link";
import { ReactNode } from "react";
import { adminUi } from "@/components/admin/admin-ui";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number | ReactNode;
  icon?: LucideIcon;
  description?: string;
  className?: string;
  href?: string;
  delta?: string;
  deltaPositive?: boolean;
}

export default function StatCard({
  label,
  value,
  icon: Icon,
  description,
  className = "",
  href,
  delta,
  deltaPositive,
}: StatCardProps) {
  const content = (
    <>
      <div className="mb-3 flex items-center justify-between">
        <span className={adminUi.sectionLabel}>{label}</span>
        {Icon ? (
          <Icon className="h-3.5 w-3.5 text-black/25" strokeWidth={1.5} />
        ) : null}
      </div>
      <div
        className="text-[26px] font-medium tracking-tight text-black tabular-nums"
        style={{ fontFamily: "var(--font-display), sans-serif" }}
      >
        {value}
      </div>
      {delta ? (
        <p
          className={cn(
            "mt-2 text-[13px]",
            deltaPositive === false ? "text-black/40" : "text-black/55",
          )}
        >
          {delta}
          {description ? (
            <span className="ml-1 text-black/35">{description}</span>
          ) : null}
        </p>
      ) : description ? (
        <p className="mt-2 text-[13px] leading-relaxed text-black/40">
          {description}
        </p>
      ) : null}
    </>
  );

  const cardClasses = cn(
    "block h-full bg-transparent py-1 transition-opacity hover:opacity-70",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={cardClasses}>
        {content}
      </Link>
    );
  }

  return <div className={cardClasses}>{content}</div>;
}
