"use client";

import { ReactNode, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { adminUi } from "@/components/admin/admin-ui";
import { cn } from "@/lib/utils";

export interface SectionMode {
  id: string;
  label: string;
  icon?: ReactNode;
}

interface SectionCardProps {
  title?: string | ReactNode;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
  headerClassName?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  summary?: ReactNode;
  modes?: SectionMode[];
  currentMode?: string;
  onModeChange?: (mode: string) => void;
  padded?: boolean;
}

/** Seamless section - no card chrome; blends into homepage canvas */
export default function SectionCard({
  title,
  children,
  action,
  className = "",
  headerClassName = "",
  collapsible = false,
  defaultExpanded = true,
  summary,
  modes,
  currentMode,
  onModeChange,
}: SectionCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className={cn("w-full bg-transparent", className)}>
      {(title || action || modes || collapsible) && (
        <div className={cn("mb-5", headerClassName)}>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              {title &&
                (typeof title === "string" ? (
                  <h2 className={adminUi.sectionLabel}>{title}</h2>
                ) : (
                  <div className={adminUi.sectionLabel}>{title}</div>
                ))}
            </div>

            <div className="flex items-center gap-3">
              {modes && modes.length > 0 && onModeChange && (
                <div className="flex gap-4">
                  {modes.map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onModeChange(mode.id);
                      }}
                      className={cn(
                        "flex items-center gap-1.5 text-[13px] font-medium transition-colors",
                        currentMode === mode.id
                          ? "text-black"
                          : "text-black/35 hover:text-black",
                      )}
                      title={mode.label}
                    >
                      {mode.icon}
                      <span className="hidden sm:inline">{mode.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {action && <div className="flex items-center">{action}</div>}

              {collapsible && (
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-1.5 text-black/30 transition-colors hover:text-black"
                  aria-label={isExpanded ? "Collapse" : "Expand"}
                >
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="w-full">
        {isExpanded ? children : summary ? summary : null}
      </div>
    </div>
  );
}
