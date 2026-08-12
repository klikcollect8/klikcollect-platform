"use client";

import { adminUi } from "@/components/admin/admin-ui";
import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export default function PageContainer({
  children,
  className = "",
}: PageContainerProps) {
  return (
    <div className={cn("mb-8 w-full max-w-none space-y-10", className)}>
      {children}
    </div>
  );
}

export function AdminPageHeader({
  title,
  description,
  actions,
  badge,
  eyebrow = "Admin",
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  eyebrow?: string;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex w-full flex-col gap-5 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="max-w-2xl">
        <div className="flex items-center gap-2.5">
          <p className={adminUi.pageEyebrow}>{eyebrow}</p>
          {badge}
        </div>
        <h1
          className={cn(adminUi.pageTitle, "mt-2")}
          style={{ fontFamily: "var(--font-display), sans-serif" }}
        >
          {title}
        </h1>
        {description ? (
          <p className={cn(adminUi.pageDesc, "mt-2 max-w-lg")}>{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
