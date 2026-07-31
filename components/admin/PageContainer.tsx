"use client";

import { ui } from "@/components/system/tokens";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export default function PageContainer({
  children,
  className = "",
}: PageContainerProps) {
  return (
    <div className={`mb-8 w-full space-y-10 ${className}`}>{children}</div>
  );
}

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <p className={ui.pageEyebrow}>Admin</p>
        <h1
          className={`mt-2 ${ui.pageTitle}`}
          style={{ fontFamily: "var(--font-display), sans-serif" }}
        >
          {title}
        </h1>
        {description ? (
          <p className={`mt-2 max-w-lg ${ui.pageDesc}`}>{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
