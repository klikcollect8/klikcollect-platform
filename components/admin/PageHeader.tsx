"use client";

import { ReactNode } from "react";
import { AdminPageHeader } from "@/components/admin/PageContainer";

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
    <AdminPageHeader
      title={title}
      description={description}
      actions={action}
      badge={badge}
      className="mb-10"
    />
  );
}
