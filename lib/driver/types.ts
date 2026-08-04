export type DriverDelivery = {
  id: string;
  public_id: string;
  status: string;
  customer_name: string | null;
  customer_phone: string | null;
  address_text: string | null;
  lat: number | null;
  lng: number | null;
  otp_code?: string | null;
  order_public_id?: string | null;
  vendor_public_id?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
  assigned_at?: string | null;
};

export type DriverSheetMode =
  | "offline"
  | "idle"
  | "offer"
  | "active"
  | "complete";

export function isActiveDeliveryStatus(status: string) {
  return (
    status === "assigned" || status === "picked_up" || status === "in_transit"
  );
}

export function nextStatusAction(status: string): {
  label: string;
  status: string;
} | null {
  if (status === "assigned")
    return { label: "Start trip", status: "in_transit" };
  if (status === "picked_up")
    return { label: "En route", status: "in_transit" };
  if (status === "in_transit")
    return { label: "Complete delivery", status: "delivered" };
  return null;
}

export function stepLabel(status: string) {
  if (status === "assigned") return "1 · Head to pickup / stop";
  if (status === "picked_up") return "2 · Drop off customer";
  if (status === "in_transit") return "2 · Drop off customer";
  if (status === "delivered") return "Delivered";
  return status;
}
