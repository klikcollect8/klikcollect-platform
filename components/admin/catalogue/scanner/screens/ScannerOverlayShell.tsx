"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  eyebrow: string;
  /** Light canvas (default) matches sign-in / profile / search overlays. */
  variant?: "light" | "dark";
  /** Center: narrow focused column. Top: scrollable document layout. */
  align?: "center" | "top";
  dismissKind?: "close" | "back";
  ariaLabel?: string;
  onDismiss?: () => void;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
};

/**
 * Individual scanner pop-up screen. Mirrors the shared overlay language of
 * SignInModal / ProfileMenu / MobileSearch: flat canvas, max-w-[1200px] shell,
 * uppercase eyebrow header with Esc + icon dismiss, soft fade/slide entry.
 */
export default function ScannerOverlayShell({
  eyebrow,
  variant = "light",
  align = "center",
  dismissKind = "close",
  ariaLabel,
  onDismiss,
  className,
  bodyClassName,
  children,
}: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const dark = variant === "dark";
  const DismissIcon = dismissKind === "back" ? ArrowLeft : X;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel || eyebrow}
      className={cn(
        "absolute inset-0 z-30 transition-opacity duration-300 ease-out",
        dark ? "bg-black text-white" : "bg-[#f7f7f5] text-black",
        visible ? "opacity-100" : "opacity-0",
        className,
      )}
    >
      <div className="relative mx-auto flex h-full w-full max-w-[1200px] flex-col px-5 sm:px-8 lg:px-12">
        <header className="flex shrink-0 items-center justify-between pt-[max(1.25rem,env(safe-area-inset-top,0px))] sm:pt-7">
          <p
            className={cn(
              "text-[11px] font-medium uppercase tracking-[0.22em]",
              dark ? "text-white/40" : "text-black/40",
            )}
          >
            {eyebrow}
          </p>
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              className={cn(
                "inline-flex min-h-11 min-w-11 items-center justify-end gap-2 text-[13px] transition-colors",
                dark
                  ? "text-white/50 hover:text-white"
                  : "text-black/45 hover:text-black",
              )}
              aria-label={dismissKind === "back" ? "Back" : "Close"}
            >
              <span className="hidden sm:inline">Esc</span>
              <DismissIcon className="h-5 w-5" strokeWidth={1.5} />
            </button>
          ) : null}
        </header>

        <div
          className={cn(
            "transition-all duration-500 ease-out",
            align === "center"
              ? "flex min-h-0 flex-1 items-center justify-center overflow-y-auto py-14"
              : "min-h-0 flex-1 overflow-y-auto pb-16 pt-8 sm:pt-10",
            visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
            bodyClassName,
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
