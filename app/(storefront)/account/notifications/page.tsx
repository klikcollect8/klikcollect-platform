"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  loadNotificationPrefs,
  saveNotificationPrefs,
  type NotificationPrefs,
} from "@/lib/account-storage";
import {
  loadCustomerNotifications,
  saveCustomerNotifications,
  type CustomerNotification,
} from "@/lib/customer-notifications";
import { openSellApplicationTracker } from "@/components/SellApplicationTrackerPanel";
import { useToast } from "@/components/ToastProvider";

const PREFS: { key: keyof NotificationPrefs; label: string; desc: string }[] = [
  {
    key: "orderUpdates",
    label: "Order updates",
    desc: "Pickup status and collection reminders.",
  },
  {
    key: "priceDrops",
    label: "Price drops",
    desc: "When wishlist items go on sale.",
  },
  {
    key: "newProducts",
    label: "New products",
    desc: "Fresh drops from Nairobi vendors.",
  },
  {
    key: "promotions",
    label: "Promotions",
    desc: "Offers and seasonal campaigns.",
  },
];

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

export default function AccountNotificationsPage() {
  const { showToast } = useToast();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [inbox, setInbox] = useState<CustomerNotification[]>([]);

  useEffect(() => {
    setPrefs(loadNotificationPrefs());
    setInbox(loadCustomerNotifications());
    const onNotify = () => setInbox(loadCustomerNotifications());
    window.addEventListener("kc:notifications", onNotify);
    return () => window.removeEventListener("kc:notifications", onNotify);
  }, []);

  const toggle = (key: keyof NotificationPrefs) => {
    if (!prefs) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    saveNotificationPrefs(next);
    showToast("Notification preferences saved", "success");
  };

  const markRead = (id: string) => {
    const next = inbox.map((n) => (n.id === id ? { ...n, read: true } : n));
    setInbox(next);
    saveCustomerNotifications(next);
  };

  return (
    <div className="space-y-12 text-left">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-black/35">
          Notifications
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-black/45">
          Inbox for application and account alerts, plus email preferences.
        </p>
      </div>

      <section>
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-[16px] font-medium tracking-tight">Inbox</h2>
          {inbox.some((n) => !n.read) ? (
            <button
              type="button"
              onClick={() => {
                const next = inbox.map((n) => ({ ...n, read: true }));
                setInbox(next);
                saveCustomerNotifications(next);
              }}
              className="text-[13px] text-black/45 underline underline-offset-[5px] decoration-black/20 hover:text-black"
            >
              Mark all read
            </button>
          ) : null}
        </div>

        {inbox.length === 0 ? (
          <p className="mt-6 text-[14px] text-black/40">No notifications yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-black/[0.08] border-t border-black/[0.08]">
            {inbox.map((n) => (
              <li key={n.id}>
                {n.href ? (
                  <Link
                    href={n.href}
                    onClick={(e) => {
                      markRead(n.id);
                      if (n.href?.includes("/account/sell-application")) {
                        e.preventDefault();
                        openSellApplicationTracker();
                      }
                    }}
                    className="block py-4 transition-opacity hover:opacity-70"
                  >
                    <InboxRow n={n} />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => markRead(n.id)}
                    className="block w-full py-4 text-left transition-opacity hover:opacity-70"
                  >
                    <InboxRow n={n} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-[16px] font-medium tracking-tight">Email</h2>
        <p className="mt-1 text-[13px] text-black/40">
          Choose what we should email you about.
        </p>

        {!prefs ? (
          <p className="mt-6 text-[14px] text-black/35">Loading…</p>
        ) : (
          <ul className="mt-4">
            {PREFS.map((pref) => (
              <li key={pref.key}>
                <button
                  type="button"
                  onClick={() => toggle(pref.key)}
                  className="flex w-full items-center justify-between gap-4 border-b border-black/[0.08] py-4 text-left transition-colors hover:text-black"
                >
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium text-black">
                      {pref.label}
                    </p>
                    <p className="mt-0.5 text-[13px] text-black/35">
                      {pref.desc}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] uppercase tracking-[0.14em] text-black/25">
                    {prefs[pref.key] ? "On" : "Off"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function InboxRow({ n }: { n: CustomerNotification }) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <p
          className={`text-[15px] font-medium ${
            n.read ? "text-black/55" : "text-black"
          }`}
        >
          {n.title}
        </p>
        {!n.read ? (
          <span className="h-1.5 w-1.5 shrink-0 bg-black" aria-label="Unread" />
        ) : null}
      </div>
      <p className="mt-1 text-[14px] leading-relaxed text-black/45">{n.body}</p>
      <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-black/30">
        {formatWhen(n.createdAt)}
      </p>
    </>
  );
}
