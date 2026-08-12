"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
};

/** Right slide-over panel (admin detail inspector). */
export default function SlideOver({
  open,
  onClose,
  title = "Details",
  subtitle,
  children,
  footer,
  wide,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = requestAnimationFrame(() => setEntered(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(t);
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end">
      <button
        type="button"
        className={cn(
          "absolute inset-0 bg-slate-900/30 backdrop-blur-[2px] transition-opacity duration-200",
          entered ? "opacity-100" : "opacity-0",
        )}
        aria-label="Close"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative flex h-full w-full flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-out",
          wide ? "max-w-2xl" : "max-w-xl",
          entered ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
              {title}
            </p>
            {subtitle ? (
              <p className="mt-1 truncate text-[15px] font-medium text-slate-900">
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-slate-400 hover:text-slate-900"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer ? (
          <footer className="shrink-0 border-t border-slate-100 px-5 py-4">
            {footer}
          </footer>
        ) : null}
      </aside>
    </div>,
    document.body,
  );
}
