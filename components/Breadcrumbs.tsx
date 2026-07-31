"use client";

import Link from "next/link";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-black/40">
      <Link href="/" className="transition-colors hover:text-black">
        Home
      </Link>
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex items-center gap-2">
          <span className="text-black/20">/</span>
          {item.href ? (
            <Link href={item.href} className="transition-colors hover:text-black">
              {item.label}
            </Link>
          ) : (
            <span className="text-black/70">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
