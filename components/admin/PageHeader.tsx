"use client";

import { ReactNode } from "react";
import { adminUi } from "@/components/admin/admin-ui";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  badge?: ReactNode;
}

export default function PageHeader({
  title,
  description,
  action,
  badge,
}: PageHeaderProps) {
  return (
    <div className="mb-10 flex w-full flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl flex-1">
        <div className="mb-2 flex items-center gap-2.5">
          <p className={adminUi.pageEyebrow}>Admin</p>
          {badge}
        </div>
        <h1
          className={adminUi.pageTitle}
          style={{ fontFamily: "var(--font-display), sans-serif" }}
        >
          {title}
        </h1>
        {description ? (
          <p className={cn(adminUi.pageDesc, "mt-2 max-w-lg")}>{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
