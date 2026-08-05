"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type MapListPanelProps = {
  title?: string;
  subtitle?: string;
  header?: ReactNode;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
};

/** Desktop sidebar list synced with map selection. */
export default function MapListPanel({
  title,
  subtitle,
  header,
  children,
  className,
  footer,
}: MapListPanelProps) {
  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-full flex-col border-r border-black/10 bg-[#f7f7f5]",
        className,
      )}
    >
      {(title || header) && (
        <div className="shrink-0 border-b border-black/10 px-5 py-4 sm:px-6">
          {header || (
            <>
              {title ? (
                <h2 className="text-[18px] font-medium tracking-tight text-black">
                  {title}
                </h2>
              ) : null}
              {subtitle ? (
                <p className="mt-1 text-[13px] text-black/45">{subtitle}</p>
              ) : null}
            </>
          )}
        </div>
      )}
      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto">{children}</div>
      {footer ? (
        <div className="shrink-0 border-t border-black/10 px-5 py-3">{footer}</div>
      ) : null}
    </aside>
  );
}
