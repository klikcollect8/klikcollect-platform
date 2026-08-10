/** Checkout fulfilment options + Nairobi delivery zones. */

import {
  DELIVERY_ZONES,
  getDeliveryZone,
  matchDeliveryZone,
} from "@/lib/checkout/delivery-zones";

export type FulfilmentMethod = "pickup" | "delivery";

/** @deprecated Prefer DELIVERY_ZONES — kept as slug/label list for selects */
export const DELIVERY_AREAS = [
  ...DELIVERY_ZONES.map((z) => ({
    value: z.id,
    label: z.label,
    fee: z.fee,
  })),
  { value: "other", label: "Other area", fee: 300, hint: "Type your neighbourhood" },
] as const;

/** Pickup wizard — vendor collect / hybrid, then same-day time. */
export const PICKUP_FLOW = [
  "method",
  "collect",
  "when",
  "contact",
  "payment",
  "review",
] as const;

/** Delivery — confirm live location (road-distance fee + same-day time). */
export const DELIVERY_FLOW = [
  "method",
  "location",
  "contact",
  "payment",
  "review",
] as const;

export type PickupStepId = (typeof PICKUP_FLOW)[number];
export type DeliveryStepId = (typeof DELIVERY_FLOW)[number];
export type CheckoutStepId = PickupStepId | DeliveryStepId;

export function fulfilmentLabel(m: FulfilmentMethod | null): string {
  if (m === "delivery") return "Delivery";
  if (m === "pickup") return "Click & collect";
  return "—";
}

export function resolveAreaLabel(area: string, areaOther: string): string {
  if (area === "other") return areaOther.trim() || "Custom area";
  return getDeliveryZone(area)?.label ?? area;
}

/** Map a reverse-geocode / saved-city string onto a delivery area slug. */
export function matchDeliveryArea(text: string): {
  area: string;
  areaOther: string;
} {
  const matched = matchDeliveryZone(text);
  if (matched) return { area: matched.id, areaOther: "" };
  const first = text.split(",")[0]?.trim() || text.trim();
  return { area: "other", areaOther: first };
}
