"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import PhoneAuthForm, {
  type AuthModalMode,
} from "@/components/auth/PhoneAuthForm";
import { useIsClient } from "@/lib/hooks/useIsClient";

export type { AuthModalMode };

interface SignInModalProps {
  isOpen: boolean;
  mode: AuthModalMode;
  message?: string | null;
  redirectUrl?: string;
  onModeChange: (mode: AuthModalMode) => void;
  onClose: () => void;
}

const COPY = {
  "sign-in": {
    title: "Sign in with your phone",
    alternateCta: "Create an account",
  },
  "sign-up": {
    title: "Create account with your phone",
    alternateCta: "Sign in",
  },
} as const;

/** Full-screen auth overlay - phone-first, marketplace language. */
export default function SignInModal({
  isOpen,
  mode,
  message,
  redirectUrl = "/",
  onModeChange,
  onClose,
}: SignInModalProps) {
  const mounted = useIsClient();
  const [isVisible, setIsVisible] = useState(false);
  const c = COPY[mode];

  useEffect(() => {
    if (!isOpen) {
      setIsVisible(false);
      document.body.style.overflow = "";
      return;
    }

    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsVisible(true));
    });
    document.body.style.overflow = "hidden";

    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(onClose, 280);
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, handleClose]);

  if (!mounted || !isOpen || typeof document === "undefined") return null;

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={c.title}
      className={`fixed inset-0 z-[9999] bg-[#f7f7f5]/78 backdrop-blur-xl transition-opacity duration-300 ease-out ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="relative mx-auto flex h-full w-full max-w-[1200px] flex-col px-5 sm:px-8 lg:px-12">
        <header className="absolute inset-x-5 top-0 z-10 flex items-center justify-between pt-5 sm:inset-x-8 sm:pt-7 lg:inset-x-12">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-black/40">
            Account
          </p>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center gap-2 text-[13px] text-black/45 transition-colors hover:text-black"
            aria-label="Close"
          >
            <span className="hidden sm:inline">Esc</span>
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </header>

        <div
          className={`flex min-h-0 flex-1 items-center justify-center overflow-y-auto py-20 transition-all duration-500 ease-out ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
          }`}
        >
          <div className="w-full max-w-[380px] text-center">
            <h1 className="text-[clamp(1.5rem,3vw,2rem)] font-medium tracking-tight text-black">
              {c.title}
            </h1>
            {message?.trim() ? (
              <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-black/45">
                {message.trim()}
              </p>
            ) : null}

            <div className="mt-8">
              <PhoneAuthForm mode={mode} redirectUrl={redirectUrl} />
            </div>

            <button
              type="button"
              onClick={() =>
                onModeChange(mode === "sign-in" ? "sign-up" : "sign-in")
              }
              className="mt-8 text-[13px] text-black/45 underline decoration-black/20 underline-offset-[5px] transition-colors hover:text-black hover:decoration-black"
            >
              {c.alternateCta}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
