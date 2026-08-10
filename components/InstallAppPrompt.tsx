"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "@/components/NavIcons";
import { getPublicAppUrl } from "@/lib/public-app-url";
import { useIsClient } from "@/lib/hooks/useIsClient";

const STORAGE_KEY = "klikcollect:install-prompt-dismissed";
export const OPEN_INSTALL_APP_EVENT = "openInstallApp";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type OpenDetail = { autoShare?: boolean };

function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone =
    "standalone" in window.navigator &&
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true;
  return mq || iosStandalone;
}

function detectPlatform() {
  if (typeof navigator === "undefined") {
    return { ios: false, android: false };
  }
  const ua = navigator.userAgent || "";
  const ios =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  return { ios, android };
}

function canNativeShare() {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

/** Open install UI from menus. */
export function openInstallAppPrompt(_opts?: OpenDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_INSTALL_APP_EVENT));
}

/**
 * Full-screen install overlay — Cart / Checkout chrome.
 * Install app only (no QR).
 */
export default function InstallAppPrompt() {
  const mounted = useIsClient();
  const [open, setOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);
  const platform = detectPlatform();

  useEffect(() => {
    deferredRef.current = deferred;
  }, [deferred]);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    window.setTimeout(() => setOpen(false), 280);
  }, []);

  const show = useCallback(() => {
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsVisible(true));
    });
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    let autoTimer: number | undefined;
    let onOpen: (() => void) | undefined;
    let onBip: ((e: Event) => void) | undefined;

    void (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (cancelled || Capacitor.isNativePlatform()) return;
      } catch {
        /* web without Capacitor */
      }
      if (cancelled || isStandaloneDisplay()) return;

      onOpen = () => show();
      window.addEventListener(OPEN_INSTALL_APP_EVENT, onOpen);

      try {
        if (localStorage.getItem(STORAGE_KEY) !== "1") {
          autoTimer = window.setTimeout(show, 8000);
        }
      } catch {
        autoTimer = window.setTimeout(show, 8000);
      }

      onBip = (e: Event) => {
        e.preventDefault();
        const ev = e as BeforeInstallPromptEvent;
        setDeferred(ev);
        deferredRef.current = ev;
      };
      window.addEventListener("beforeinstallprompt", onBip);
    })();

    return () => {
      cancelled = true;
      if (onOpen) window.removeEventListener(OPEN_INSTALL_APP_EVENT, onOpen);
      if (onBip) window.removeEventListener("beforeinstallprompt", onBip);
      if (autoTimer) window.clearTimeout(autoTimer);
    };
  }, [show]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  const installApp = async () => {
    const url = getPublicAppUrl(
      typeof window !== "undefined" ? window.location.origin : undefined,
    );
    setBusy(true);
    try {
      const bip = deferredRef.current;
      if (bip) {
        await bip.prompt();
        await bip.userChoice.catch(() => undefined);
        setDeferred(null);
        deferredRef.current = null;
        handleClose();
        return;
      }
      if (canNativeShare()) {
        await navigator.share({
          title: "KlikCollect",
          text: "Install KlikCollect on your home screen",
          url,
        });
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "AbortError") return;
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setBusy(false);
    }
  };

  const supportLine = deferred
    ? "Add KlikCollect to your home screen in one tap."
    : platform.ios
      ? "Opens Share — choose Add to Home Screen."
      : platform.android
        ? "Install to your home screen for faster checkout."
        : "Install KlikCollect for a full-screen home screen app.";

  if (!mounted || !open || typeof document === "undefined") return null;

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Install app"
      className={`fixed inset-0 z-[9999] bg-[#f7f7f5]/78 backdrop-blur-xl transition-opacity duration-300 ease-out ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="mx-auto flex h-full w-full max-w-[1200px] flex-col px-5 sm:px-8 lg:px-12">
        <header className="flex shrink-0 items-center justify-between pt-5 sm:pt-7">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-black/40">
            Get the app
          </p>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center gap-2 text-[13px] text-black/45 transition-colors hover:text-black"
            aria-label="Close"
          >
            <span className="hidden sm:inline">Esc</span>
            <CloseIcon size={20} />
          </button>
        </header>

        <div
          className={`mt-6 shrink-0 border-b border-black/15 pb-5 transition-all duration-500 ease-out sm:mt-8 sm:pb-6 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
          }`}
        >
          <h1 className="text-[clamp(1.5rem,3vw,2rem)] font-medium tracking-tight text-black">
            Install KlikCollect
          </h1>
          <p className="mt-2 max-w-md text-[14px] leading-relaxed text-black/45">
            {supportLine}
          </p>
        </div>

        <div
          className={`scrollbar-hide flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto pb-8 pt-10 transition-all duration-500 ease-out sm:pt-12 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          }`}
        >
          <div
            className="flex h-28 w-28 items-center justify-center bg-black sm:h-32 sm:w-32"
            aria-hidden
          >
            <span className="text-[2.75rem] font-semibold tracking-tight text-[#f7f7f5] sm:text-[3.25rem]">
              KC
            </span>
          </div>
          <p className="mt-8 max-w-sm text-center text-[15px] leading-relaxed text-black/50">
            Home screen access to shop, bag, and checkout — same account, same
            orders.
          </p>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-black/10 bg-[#f7f7f5]/95 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-md">
          <button
            type="button"
            onClick={handleClose}
            className="min-h-11 px-2 text-[13px] text-black/45 hover:text-black"
          >
            Not now
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void installApp()}
            className="inline-flex min-h-12 items-center bg-black px-7 text-[12px] font-medium uppercase tracking-[0.16em] text-white hover:opacity-80 disabled:opacity-45"
          >
            {busy ? "Opening…" : "Install app"}
          </button>
        </footer>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
