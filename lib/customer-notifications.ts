/**
 * Customer notification inbox (browser localStorage).
 * Shared by NotificationsPanel + account notifications page.
 */

export type CustomerNotification = {
  id: string;
  title: string;
  body: string;
  href?: string;
  createdAt: string;
  read: boolean;
};

export const CUSTOMER_NOTIFICATIONS_KEY = "kc_customer_notifications";

function seedNotifications(): CustomerNotification[] {
  const now = Date.now();
  return [
    {
      id: "welcome",
      title: "Welcome to KlikCollect",
      body: "Browse vendors near you and collect when it suits you.",
      href: "/brands",
      createdAt: new Date(now - 1000 * 60 * 45).toISOString(),
      read: false,
    },
    {
      id: "orders-tip",
      title: "Track your orders",
      body: "Pickup updates and collection reminders will show up here.",
      href: "/account/orders",
      createdAt: new Date(now - 1000 * 60 * 60 * 6).toISOString(),
      read: false,
    },
  ];
}

export function loadCustomerNotifications(): CustomerNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOMER_NOTIFICATIONS_KEY);
    if (!raw) {
      const seeded = seedNotifications();
      localStorage.setItem(
        CUSTOMER_NOTIFICATIONS_KEY,
        JSON.stringify(seeded),
      );
      return seeded;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : seedNotifications();
  } catch {
    return [];
  }
}

export function saveCustomerNotifications(items: CustomerNotification[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CUSTOMER_NOTIFICATIONS_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("kc:notifications"));
  } catch {
    /* ignore */
  }
}

/** Prepend a notification (dedupes by id). */
export function pushCustomerNotification(
  item: Omit<CustomerNotification, "createdAt" | "read"> & {
    createdAt?: string;
    read?: boolean;
  },
) {
  const next: CustomerNotification = {
    id: item.id,
    title: item.title,
    body: item.body,
    href: item.href,
    createdAt: item.createdAt || new Date().toISOString(),
    read: item.read ?? false,
  };
  const prev = loadCustomerNotifications().filter((n) => n.id !== next.id);
  saveCustomerNotifications([next, ...prev].slice(0, 50));
  return next;
}
