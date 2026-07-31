"use client";

export type SavedAddress = {
  id: string;
  name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  isDefault: boolean;
};

export type SavedPayment = {
  id: string;
  type: "card";
  last4: string;
  brand: string;
  expiryMonth: string;
  expiryYear: string;
  isDefault: boolean;
};

export type NotificationPrefs = {
  orderUpdates: boolean;
  priceDrops: boolean;
  newProducts: boolean;
  promotions: boolean;
};

export type AccountPreferences = {
  emailDigest: "instant" | "daily" | "weekly";
  smsAlerts: boolean;
  showPricesInclVat: boolean;
};

const KEYS = {
  addresses: "user_addresses",
  payments: "user_payment_methods",
  notifications: "notification_prefs",
  preferences: "account_preferences",
} as const;

const defaultNotificationPrefs: NotificationPrefs = {
  orderUpdates: true,
  priceDrops: true,
  newProducts: false,
  promotions: false,
};

const defaultAccountPreferences: AccountPreferences = {
  emailDigest: "instant",
  smsAlerts: false,
  showPricesInclVat: true,
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadAddresses(): SavedAddress[] {
  return read<SavedAddress[]>(KEYS.addresses, []);
}

export function saveAddresses(addresses: SavedAddress[]) {
  write(KEYS.addresses, addresses);
}

export function loadPayments(): SavedPayment[] {
  return read<SavedPayment[]>(KEYS.payments, []);
}

export function savePayments(payments: SavedPayment[]) {
  write(KEYS.payments, payments);
}

export function loadNotificationPrefs(): NotificationPrefs {
  return read<NotificationPrefs>(KEYS.notifications, defaultNotificationPrefs);
}

export function saveNotificationPrefs(prefs: NotificationPrefs) {
  write(KEYS.notifications, prefs);
}

export function loadAccountPreferences(): AccountPreferences {
  return read<AccountPreferences>(KEYS.preferences, defaultAccountPreferences);
}

export function saveAccountPreferences(prefs: AccountPreferences) {
  write(KEYS.preferences, prefs);
}
