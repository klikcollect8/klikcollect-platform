/** Checkout fulfilment options + Nairobi delivery areas. */

export type FulfilmentMethod = "pickup" | "delivery";

export const DELIVERY_AREAS = [
  { value: "westlands", label: "Westlands" },
  { value: "kilimani", label: "Kilimani" },
  { value: "karen", label: "Karen" },
  { value: "lavington", label: "Lavington" },
  { value: "parklands", label: "Parklands" },
  { value: "cbd", label: "Nairobi CBD" },
  { value: "south_c", label: "South C" },
  { value: "runda", label: "Runda" },
  { value: "gigiri", label: "Gigiri" },
  { value: "other", label: "Other area", hint: "Type your neighbourhood" },
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

/** Delivery — confirm location (incl. instructions + same-day time). */
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
  return DELIVERY_AREAS.find((a) => a.value === area)?.label ?? area;
}

/** Map a reverse-geocode / saved-city string onto a delivery area slug. */
export function matchDeliveryArea(text: string): {
  area: string;
  areaOther: string;
} {
  const lower = text.toLowerCase();
  for (const a of DELIVERY_AREAS) {
    if (a.value === "other") continue;
    const label = a.label.toLowerCase();
    const slug = a.value.replace(/_/g, " ");
    if (lower.includes(label) || lower.includes(slug)) {
      return { area: a.value, areaOther: "" };
    }
  }
  // CBD aliases
  if (lower.includes("central business") || lower.includes("nairobi cbd")) {
    return { area: "cbd", areaOther: "" };
  }
  const first = text.split(",")[0]?.trim() || text.trim();
  return { area: "other", areaOther: first };
}
