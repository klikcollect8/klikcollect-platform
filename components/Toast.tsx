"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  duration?: number;
  actionHref?: string;
  actionLabel?: string;
}

const LABELS: Record<ToastType, string> = {
  success: "Done",
  error: "Error",
  info: "Note",
};

export default function Toast({
  message,
  type,
  onClose,
  duration = 3800,
  actionHref,
  actionLabel,
}: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const show = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 280);
    }, duration);
    return () => {
      cancelAnimationFrame(show);
      clearTimeout(timer);
    };
  }, [duration, onClose]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 280);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed left-1/2 top-[84px] z-[10000] w-[min(92vw,420px)] -translate-x-1/2 transition-all duration-300 ease-out ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
      }`}
    >
      <div className="border border-black/10 bg-[#f7f7f5]/92 px-5 py-4 shadow-[0_24px_80px_rgba(0,0,0,0.12)] backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-black/35">
              {LABELS[type]}
            </p>
            <p className="mt-1.5 text-[15px] font-medium leading-snug tracking-tight text-black">
              {message}
            </p>
            {actionHref && actionLabel ? (
              <Link
                href={actionHref}
                onClick={handleClose}
                className="mt-2 inline-block text-[13px] text-black/50 underline underline-offset-4 decoration-black/20 transition-colors hover:text-black hover:decoration-black"
              >
                {actionLabel}
              </Link>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-black/30 transition-colors hover:text-black"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
        <div
          className={`mt-3 h-px w-full ${
            type === "error" ? "bg-black/25" : "bg-black/[0.08]"
          }`}
        />
      </div>
    </div>
  );
}
