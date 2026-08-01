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
    <nav className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-black/40 sm:text-[13px]">
      <Link href="/" className="shrink-0 transition-colors hover:text-black">
        Home
      </Link>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span
            key={`${item.label}-${index}`}
            className={`flex min-w-0 items-center gap-2 ${isLast ? "max-w-full" : ""}`}
          >
            <span className="shrink-0 text-black/20">/</span>
            {item.href ? (
              <Link
                href={item.href}
                className="truncate transition-colors hover:text-black"
              >
                {item.label}
              </Link>
            ) : (
              <span className="truncate text-black/70">{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
