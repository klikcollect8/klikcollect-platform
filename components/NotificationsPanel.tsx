"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { CloseIcon } from "@/components/NavIcons";
import { useIsClient } from "@/lib/hooks/useIsClient";
import {
  loadCustomerNotifications,
  saveCustomerNotifications,
  type CustomerNotification,
} from "@/lib/customer-notifications";
import { openSellApplicationTracker } from "@/components/SellApplicationTrackerPanel";

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-KE", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

type NotificationsPanelProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function NotificationsPanel({
  isOpen,
  onClose,
}: NotificationsPanelProps) {
  const mounted = useIsClient();
  const [isVisible, setIsVisible] = useState(false);
  const [items, setItems] = useState<CustomerNotification[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setIsVisible(false);
      document.body.style.overflow = "";
      return;
    }

    setItems(loadCustomerNotifications());
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsVisible(true));
    });
    document.body.style.overflow = "hidden";

    const onNotify = () => setItems(loadCustomerNotifications());
    window.addEventListener("kc:notifications", onNotify);

    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = "";
      window.removeEventListener("kc:notifications", onNotify);
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

  const markRead = (id: string) => {
    setItems((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      saveCustomerNotifications(next);
      return next;
    });
  };

  const markAllRead = () => {
    setItems((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      saveCustomerNotifications(next);
      return next;
    });
  };

  const clearAll = () => {
    setItems([]);
    saveCustomerNotifications([]);
  };

  if (!mounted || !isOpen || typeof document === "undefined") return null;

  const unread = items.filter((n) => !n.read).length;

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Notifications"
      className={`fixed inset-0 z-[9999] bg-[#f7f7f5]/78 backdrop-blur-xl transition-opacity duration-300 ease-out ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="mx-auto flex h-full w-full max-w-[1200px] flex-col px-5 sm:px-8 lg:px-12">
        <header className="flex shrink-0 items-center justify-between pt-5 sm:pt-7">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-black/40">
            Notifications
          </p>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center gap-2 text-[13px] text-black/45 transition-colors hover:text-black"
            aria-label="Close notifications"
          >
            <span className="hidden sm:inline">Esc</span>
            <CloseIcon size={20} />
          </button>
        </header>

        <div
          className={`mt-6 flex shrink-0 items-end justify-between gap-4 transition-all duration-500 ease-out sm:mt-8 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
          }`}
        >
          <div>
            <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-medium tracking-tight">
              Inbox
            </h2>
            <p className="mt-1.5 text-[13px] text-black/40">
              {items.length === 0
                ? "You're all caught up"
                : unread > 0
                  ? `${unread} unread`
                  : "All caught up"}
            </p>
          </div>
          {items.length > 0 ? (
            <div className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-[13px]">
              {unread > 0 ? (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-black/45 underline underline-offset-[5px] decoration-black/20 hover:text-black hover:decoration-black"
                >
                  Mark all read
                </button>
              ) : null}
              <button
                type="button"
                onClick={clearAll}
                className="text-black/45 underline underline-offset-[5px] decoration-black/20 hover:text-black hover:decoration-black"
              >
                Clear
              </button>
            </div>
          ) : null}
        </div>

        <div
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(5rem+env(safe-area-inset-bottom))] pt-8 transition-all duration-500 ease-out sm:pt-10 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          }`}
        >
          {items.length === 0 ? (
            <div className="border-t border-black/[0.08] py-16 text-center">
              <p className="text-[16px] font-medium tracking-tight">
                No notifications
              </p>
              <p className="mt-2 text-[14px] text-black/45">
                Order updates and sell application alerts will appear here.
              </p>
              <Link
                href="/account/notifications"
                onClick={handleClose}
                className="mt-6 inline-block text-[13px] underline underline-offset-[5px] decoration-black/25 hover:decoration-black"
              >
                Notification settings
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-black/[0.08] border-t border-black/[0.08]">
              {items.map((n) => {
                const inner = (
                  <>
                    <div className="flex items-baseline justify-between gap-3">
                      <p
                        className={`text-[15px] font-medium tracking-tight ${
                          n.read ? "text-black/55" : "text-black"
                        }`}
                      >
                        {n.title}
                      </p>
                      {!n.read ? (
                        <span
                          className="h-1.5 w-1.5 shrink-0 bg-black"
                          aria-label="Unread"
                        />
                      ) : null}
                    </div>
                    <p className="mt-1.5 text-[14px] leading-relaxed text-black/45">
                      {n.body}
                    </p>
                    <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-black/30">
                      {formatWhen(n.createdAt)}
                    </p>
                  </>
                );

                return (
                  <li key={n.id}>
                    {n.href ? (
                      <Link
                        href={n.href}
                        onClick={(e) => {
                          markRead(n.id);
                          handleClose();
                          if (n.href?.includes("/account/sell-application")) {
                            e.preventDefault();
                            setTimeout(() => openSellApplicationTracker(), 280);
                          }
                        }}
                        className="block py-5 transition-opacity hover:opacity-70 sm:py-6"
                      >
                        {inner}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => markRead(n.id)}
                        className="block w-full py-5 text-left transition-opacity hover:opacity-70 sm:py-6"
                      >
                        {inner}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {items.length > 0 ? (
            <div className="mt-8 text-center">
              <Link
                href="/account/notifications"
                onClick={handleClose}
                className="text-[13px] text-black/40 underline underline-offset-[5px] decoration-black/20 hover:text-black hover:decoration-black"
              >
                Notification settings
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
