import type { CartItem } from "@/types";

/** Unique vendor public ids in the bag (excludes platform). */
export function cartVendorIds(items: CartItem[]): string[] {
  return [
    ...new Set(
      items
        .map((i) => i.vendorId)
        .filter((id): id is string => !!id && id !== "platform"),
    ),
  ];
}

export function cartHasDelivery(items: CartItem[]): boolean {
  return items.some((i) => i.fulfilment === "delivery");
}

/** Prefer an area label already stamped on delivery lines. */
export function cartDeliveryAreaLabel(items: CartItem[]): string | null {
  return (
    items.find((i) => i.fulfilment === "delivery" && i.deliveryZoneLabel)
      ?.deliveryZoneLabel ||
    items.find((i) => i.neighbourhood)?.neighbourhood ||
    null
  );
}
