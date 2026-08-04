import type {
  PublicDayHours,
  PublicHolidayHours,
} from "@/lib/vendor-storefront";

export type CheckoutVendor = {
  vendorId: string;
  name: string;
  neighbourhood: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  storeName: string | null;
  openNow: boolean;
  todayLabel: string;
  weekly: PublicDayHours[];
  holidays: PublicHolidayHours[];
};

export type CollectMode = "classic" | "hybrid";
