/**
 * Persist checkout “Deliver here” pins locally and log to user activity.
 */

export type SavedDeliveryPin = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  street: string;
  building: string;
  area: string;
  landmark: string;
  gateCode: string;
  deliveryNote: string;
  savedAt: number;
  source: "map_pin" | "search" | "gps" | "address_edit" | "deliver_here";
};

const STORAGE_KEY = "klikcollect:delivery-pins";
const LATEST_KEY = "klikcollect:delivery-pin-latest";
const MAX_LOG = 30;

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function listSavedDeliveryPins(): SavedDeliveryPin[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedDeliveryPin[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getLatestSavedDeliveryPin(): SavedDeliveryPin | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(LATEST_KEY);
    if (!raw) return listSavedDeliveryPins()[0] || null;
    return JSON.parse(raw) as SavedDeliveryPin;
  } catch {
    return null;
  }
}

/** Append pin to local detail log + latest pointer. */
export function saveDeliveryPin(
  input: Omit<SavedDeliveryPin, "id" | "savedAt"> & {
    id?: string;
    savedAt?: number;
  },
): SavedDeliveryPin {
  const pin: SavedDeliveryPin = {
    id:
      input.id ||
      `pin_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    lat: input.lat,
    lng: input.lng,
    label: input.label || "Deliver here",
    street: input.street || "",
    building: input.building || "",
    area: input.area || "",
    landmark: input.landmark || "",
    gateCode: input.gateCode || "",
    deliveryNote: input.deliveryNote || "",
    savedAt: input.savedAt || Date.now(),
    source: input.source,
  };

  if (!canUseStorage()) return pin;

  try {
    const prev = listSavedDeliveryPins().filter(
      (p) =>
        !(
          Math.abs(p.lat - pin.lat) < 1e-5 && Math.abs(p.lng - pin.lng) < 1e-5
        ),
    );
    const next = [pin, ...prev].slice(0, MAX_LOG);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    localStorage.setItem(LATEST_KEY, JSON.stringify(pin));
  } catch {
    /* ignore quota */
  }

  return pin;
}

/** Best-effort activity log (signed-in users). */
export async function logDeliveryPinActivity(
  pin: SavedDeliveryPin,
): Promise<void> {
  try {
    await fetch("/api/user/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        activity_type: "delivery_pin_saved",
        activity_data: {
          lat: pin.lat,
          lng: pin.lng,
          label: pin.label,
          street: pin.street,
          building: pin.building,
          area: pin.area,
          landmark: pin.landmark,
          source: pin.source,
          savedAt: pin.savedAt,
        },
      }),
    });
  } catch {
    /* offline / signed out — local log still kept */
  }
}

export function persistAndLogDeliveryPin(
  input: Omit<SavedDeliveryPin, "id" | "savedAt"> & {
    id?: string;
    savedAt?: number;
  },
): SavedDeliveryPin {
  const pin = saveDeliveryPin(input);
  void logDeliveryPinActivity(pin);
  return pin;
}
