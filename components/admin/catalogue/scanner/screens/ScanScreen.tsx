"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const BarcodeScannerPanel = dynamic(
  () => import("@/components/admin/catalogue/scanner/BarcodeScannerPanel"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-48 items-center justify-center text-[13px] text-white/45">
        Loading camera…
      </div>
    ),
  },
);

type Props = {
  active: boolean;
  continuous: boolean;
  resumeKey: number;
  contextLabel: string;
  variant: "popup" | "page";
  historyCount: number;
  error: string | null;
  onDetected: (code: string, format?: string) => void;
  onToggleContinuous: () => void;
  onOpenManual: () => void;
  onOpenHistory: () => void;
  onRequestClose?: () => void;
};

const linkClass =
  "inline-flex min-h-11 items-center text-[13px] text-white/55 underline decoration-white/20 underline-offset-[5px] transition-colors hover:text-white hover:decoration-white";

/**
 * Base scanner screen: full camera, minimal chrome. Manual entry, history,
 * and results each live on their own pop-up screen.
 */
export default function ScanScreen({
  active,
  continuous,
  resumeKey,
  contextLabel,
  variant,
  historyCount,
  error,
  onDetected,
  onToggleContinuous,
  onOpenManual,
  onOpenHistory,
  onRequestClose,
}: Props) {
  return (
    <div className="absolute inset-0 flex flex-col bg-black text-white">
      <div className="relative z-10 mx-auto w-full max-w-[1200px] shrink-0 px-5 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between pb-3 pt-[max(1.25rem,env(safe-area-inset-top,0px))] sm:pt-7">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">
            Scanner · {contextLabel}
          </p>
          {variant === "page" ? (
            <Link
              href="/admin/products"
              className="inline-flex min-h-11 min-w-11 items-center justify-end gap-2 text-[13px] text-white/50 transition-colors hover:text-white"
              aria-label="Back to products"
            >
              <span className="hidden sm:inline">Esc</span>
              <X className="h-5 w-5" strokeWidth={1.5} />
            </Link>
          ) : onRequestClose ? (
            <button
              type="button"
              onClick={onRequestClose}
              className="inline-flex min-h-11 min-w-11 items-center justify-end gap-2 text-[13px] text-white/50 transition-colors hover:text-white"
              aria-label="Close scanner"
            >
              <span className="hidden sm:inline">Esc</span>
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
          ) : null}
        </header>
      </div>

      <div className="relative min-h-0 flex-1">
        <BarcodeScannerPanel
          active={active}
          fullscreen
          hideHeader
          autoSubmit
          continuousMode={continuous}
          resumeKey={resumeKey}
          showManualEntry={false}
          showModeToggle={false}
          className="h-full border-0 bg-black"
          onDetected={(code, meta) => onDetected(code, meta?.format)}
        />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[1200px] shrink-0 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] pt-4 sm:px-8 lg:px-12">
        {error ? (
          <p
            className="mb-3 text-center text-[12px] leading-snug text-red-300"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 sm:gap-x-8">
          <button type="button" onClick={onOpenManual} className={linkClass}>
            Enter code manually
          </button>
          <button
            type="button"
            onClick={onToggleContinuous}
            aria-pressed={continuous}
            title="Toggle continuous scanning (C)"
            className={cn(
              "inline-flex min-h-11 items-center border px-4 text-[11px] font-medium uppercase tracking-[0.14em] transition-colors",
              continuous
                ? "border-white bg-white text-black"
                : "border-white/25 text-white/60 hover:border-white/50 hover:text-white",
            )}
          >
            {continuous ? "Continuous on" : "Continuous off"}
          </button>
          <button type="button" onClick={onOpenHistory} className={linkClass}>
            History{historyCount ? ` (${historyCount})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
