"use client";

import { ReactNode } from "react";
import { ui } from "@/components/system/tokens";

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
    <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl flex-1">
        <div className="mb-2 flex items-center gap-2.5">
          <p className={ui.pageEyebrow}>Admin</p>
          {badge}
        </div>
        <h1
          className={ui.pageTitle}
          style={{ fontFamily: "var(--font-display), sans-serif" }}
        >
          {title}
        </h1>
        {description ? (
          <p className={`mt-2 max-w-lg ${ui.pageDesc}`}>{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
