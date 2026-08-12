"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
  /** Near-full review dashboard panel */
  dashboard?: boolean;
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
  dashboard,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [entered, setEntered] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const previousFocus = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = requestAnimationFrame(() => {
      setEntered(true);
      const initialButton = window.matchMedia("(min-width: 1024px)").matches
        ? closeButtonRef.current
        : backButtonRef.current;
      initialButton?.focus();
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(t);
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      previousFocus?.focus();
    };
  }, [open]);

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
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative flex h-[100dvh] w-full flex-col bg-white shadow-2xl transition-transform duration-300 ease-out lg:h-full lg:border-l lg:border-slate-200",
          dashboard ? "max-w-5xl" : wide ? "max-w-2xl" : "max-w-xl",
          entered ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="sticky top-0 z-10 flex min-h-[var(--admin-header-h,56px)] shrink-0 items-center gap-2 border-b border-slate-100 bg-white px-3 py-2 sm:px-5">
          <button
            ref={backButtonRef}
            type="button"
            onClick={onClose}
            className="flex h-11 min-w-11 shrink-0 items-center justify-center text-slate-600 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black lg:hidden"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <p
              id={titleId}
              className="text-[11px] uppercase tracking-[0.16em] text-slate-400"
            >
              {title}
            </p>
            {subtitle ? (
              <p className="mt-1 truncate text-[15px] font-medium text-slate-900">
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="ml-auto hidden h-11 min-w-11 shrink-0 items-center justify-center text-slate-400 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black lg:flex"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer ? (
          <footer className="sticky bottom-0 z-10 shrink-0 border-t border-slate-100 bg-white px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
            {footer}
          </footer>
        ) : null}
      </aside>
    </div>,
    document.body,
  );
}
