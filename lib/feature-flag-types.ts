/** Client-safe feature flag types (no Node fs). */

export const FEATURE_FLAG_KEYS = [
  "pos",
  "couriers",
  "warehouse",
  "store_ops",
  "marketing",
  "finance",
  "analytics",
  "branches",
  "customers",
  "widget_profit",
  "widget_activity",
  "widget_repeat",
  "widget_products",
  "widget_ai",
] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];
export type FeatureFlags = Record<FeatureFlagKey, boolean>;

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  pos: true,
  couriers: false,
  warehouse: false,
  store_ops: true,
  marketing: true,
  finance: true,
  analytics: true,
  branches: true,
  customers: true,
  widget_profit: true,
  widget_activity: true,
  widget_repeat: true,
  widget_products: true,
  widget_ai: true,
};

export const FEATURE_FLAG_META: Record<
  FeatureFlagKey,
  {
    label: string;
    description: string;
    group: "modules" | "planes" | "widgets";
  }
> = {
  pos: {
    label: "Point of sale",
    description: "In-store checkout and receipts",
    group: "modules",
  },
  couriers: {
    label: "Delivery (retired)",
    description: "Legacy courier plane — marketplace is pickup / receipt only",
    group: "planes",
  },
  warehouse: {
    label: "Warehouse",
    description: "Pick, pack, receiving, and warehouse roles",
    group: "planes",
  },
  store_ops: {
    label: "Store floor",
    description: "Cashier, sales assistant, and stock clerk roles",
    group: "planes",
  },
  marketing: {
    label: "Marketing",
    description: "Coupons, campaigns, and promotions",
    group: "modules",
  },
  finance: {
    label: "Finance",
    description: "Settlements, payouts, and ledger views",
    group: "modules",
  },
  analytics: {
    label: "Analytics",
    description: "Usage and performance reports",
    group: "modules",
  },
  branches: {
    label: "Branches",
    description: "Multi-location store management",
    group: "modules",
  },
  customers: {
    label: "Customers",
    description: "Buyer list derived from orders",
    group: "modules",
  },
  widget_profit: {
    label: "Total profit",
    description: "Revenue trend chart on the dashboard",
    group: "widgets",
  },
  widget_activity: {
    label: "Most active day",
    description: "Weekly activity bars on the dashboard",
    group: "widgets",
  },
  widget_repeat: {
    label: "Repeat rate",
    description: "Customer retention gauge",
    group: "widgets",
  },
  widget_products: {
    label: "Best sellers",
    description: "Top products table on the dashboard",
    group: "widgets",
  },
  widget_ai: {
    label: "AI assistant",
    description: "Dashboard assistant card",
    group: "widgets",
  },
};

/** Map nav href → flag that must be on (undefined = always available). */
export const NAV_FEATURE_FLAGS: Record<string, FeatureFlagKey | undefined> = {
  "/app/pos": "pos",
  "/app/warehouse": "warehouse",
  "/app/marketing": "marketing",
  "/app/finance": "finance",
  "/app/analytics": "analytics",
  "/app/branches": "branches",
  "/app/customers": "customers",
};
