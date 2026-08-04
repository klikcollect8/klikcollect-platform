"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Capacitor } from "@capacitor/core";
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

function canNativeShare() {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

/** Open install UI from menus. */
export function openInstallAppPrompt(opts?: OpenDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(OPEN_INSTALL_APP_EVENT, {
      detail: { autoShare: opts?.autoShare === true },
    }),
  );
}

/**
 * Full-screen install overlay — same chrome as Cart / Checkout.
 * QR + Install app only.
 */
export default function InstallAppPrompt() {
  const mounted = useIsClient();
  const [open, setOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [pageOrigin, setPageOrigin] = useState("");
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);

  const shareUrl = useMemo(
    () => getPublicAppUrl(pageOrigin || undefined),
    [pageOrigin],
  );

  const qrSrc = shareUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(shareUrl)}`
    : "";

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
    setPageOrigin(window.location.origin);
    if (Capacitor.isNativePlatform()) return;
    if (isStandaloneDisplay()) return;

    const onOpen = () => show();
    window.addEventListener(OPEN_INSTALL_APP_EVENT, onOpen);

    let autoTimer: number | undefined;
    try {
      if (localStorage.getItem(STORAGE_KEY) !== "1") {
        autoTimer = window.setTimeout(show, 2200);
      }
    } catch {
      autoTimer = window.setTimeout(show, 2200);
    }

    const onBip = (e: Event) => {
      e.preventDefault();
      const ev = e as BeforeInstallPromptEvent;
      setDeferred(ev);
      deferredRef.current = ev;
    };
    window.addEventListener("beforeinstallprompt", onBip);

    return () => {
      window.removeEventListener(OPEN_INSTALL_APP_EVENT, onOpen);
      window.removeEventListener("beforeinstallprompt", onBip);
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
          text: "Install KlikCollect",
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
      <div className="relative mx-auto flex h-full w-full max-w-[720px] flex-col px-5 sm:px-8">
        <header className="flex shrink-0 items-center justify-between pt-5 sm:pt-7">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-black/40">
            Get the app
          </p>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 text-[13px] text-black/45 transition-colors hover:text-black"
            aria-label="Close"
          >
            <span className="hidden sm:inline">Esc</span>
            <CloseIcon size={20} />
          </button>
        </header>

        <div
          className={`scrollbar-hide min-h-0 flex-1 overflow-y-auto pb-8 pt-10 transition-all duration-500 ease-out sm:pt-14 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          }`}
        >
          <h2 className="text-[clamp(1.5rem,4vw,2rem)] font-medium tracking-tight">
            Install KlikCollect
          </h2>
          <p className="mt-3 text-[14px] text-black/45">
            Scan on your phone, then tap Install app.
          </p>

          {qrSrc ? (
            <div className="mt-10 flex justify-center border border-black/8 bg-white p-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrSrc}
                alt="QR code for KlikCollect"
                width={220}
                height={220}
                className="h-[200px] w-[200px] sm:h-[220px] sm:w-[220px]"
              />
            </div>
          ) : null}

          <p className="mt-4 break-all text-center text-[12px] text-black/35">
            {shareUrl}
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
