/**
 * Public vendor storefront - profile, hours, locations, reviews.
 * Reads admitted vendors only; no auth required.
 */
import { getServiceSupabase } from "@/lib/supabase/admin";
import {
  getAdmittedVendorBySlug,
  getVendorProducts,
  type AdmittedVendor,
} from "@/lib/admitted-vendors";
import { listVendorQuestions, listVendorReviews } from "@/lib/vendor-content";

export type StorefrontSettings = {
  announcement?: string;
  highlight?: string;
  showReviews?: boolean;
  showLocations?: boolean;
  showHours?: boolean;
  showStory?: boolean;
  featuredCategory?: string;
};

export type PublicVendorProfile = AdmittedVendor & {
  displayName: string;
  description: string;
  story: string;
  logoUrl: string;
  bannerUrl: string;
  themeColor: string;
  contactEmail: string;
  contactPhone: string;
  whatsapp: string;
  city: string;
  specialty: string;
  socials: Record<string, string>;
  policies: {
    returns?: string;
    [key: string]: unknown;
  };
  storefront: StorefrontSettings;
};

export type PublicBranch = {
  id: string;
  publicId: string;
  name: string;
  neighbourhood: string | null;
  address: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  isPrimary: boolean;
};

export type PublicDayHours = {
  dayOfWeek: number;
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean;
};

export type PublicHolidayHours = {
  date: string;
  label: string;
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean;
};

export type PublicStoreHours = {
  storePublicId: string;
  storeName: string;
  weekly: PublicDayHours[];
  holidays: PublicHolidayHours[];
  openNow: boolean;
  todayLabel: string;
};

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function defaultStorefront(raw: unknown): StorefrontSettings {
  const s =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    announcement: typeof s.announcement === "string" ? s.announcement : "",
    highlight: typeof s.highlight === "string" ? s.highlight : "",
    showReviews: s.showReviews !== false,
    showLocations: s.showLocations !== false,
    showHours: s.showHours !== false,
    showStory: s.showStory !== false,
    featuredCategory:
      typeof s.featuredCategory === "string" ? s.featuredCategory : "",
  };
}

function nairobiNowParts() {
  const parts = new Intl.DateTimeFormat("en-KE", {
    timeZone: "Africa/Nairobi",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  const weekday = get("weekday");
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dayOfWeek = map[weekday] ?? new Date().getDay();
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  const minutes = hour * 60 + minute;
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  return { dayOfWeek, minutes, date };
}

function parseHm(t: string | null | undefined): number | null {
  if (!t) return null;
  const [h, m] = String(t).slice(0, 5).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function computeOpenNow(
  weekly: PublicDayHours[],
  holidays: PublicHolidayHours[],
): { openNow: boolean; todayLabel: string } {
  const { dayOfWeek, minutes, date } = nairobiNowParts();
  const holiday = holidays.find((h) => h.date === date);
  if (holiday) {
    if (holiday.isClosed) {
      return { openNow: false, todayLabel: `${holiday.label} · Closed` };
    }
    const open = parseHm(holiday.openTime);
    const close = parseHm(holiday.closeTime);
    const openNow =
      open != null && close != null && minutes >= open && minutes < close;
    return {
      openNow,
      todayLabel: openNow
        ? `${holiday.label} · Open now`
        : `${holiday.label} · Closed`,
    };
  }
  const day = weekly.find((d) => d.dayOfWeek === dayOfWeek);
  if (!day || day.isClosed) {
    return { openNow: false, todayLabel: `${DAY_NAMES[dayOfWeek]} · Closed` };
  }
  const open = parseHm(day.openTime);
  const close = parseHm(day.closeTime);
  const openNow =
    open != null && close != null && minutes >= open && minutes < close;
  const range =
    day.openTime && day.closeTime
      ? `${day.openTime.slice(0, 5)}-${day.closeTime.slice(0, 5)}`
      : "";
  return {
    openNow,
    todayLabel: openNow
      ? `Open now · ${range}`
      : `Closed · ${DAY_NAMES[dayOfWeek]} ${range}`,
  };
}

export async function getPublicVendorProfile(
  slug: string,
): Promise<PublicVendorProfile | null> {
  const base = await getAdmittedVendorBySlug(slug);
  if (!base) return null;

  const sb = getServiceSupabase();
  const [{ data: vendor }, { data: profile }] = await Promise.all([
    sb
      .from("vendors")
      .select(
        "public_id, name, description, city, neighbourhood, address_text, specialty, contact_email, contact_phone, logo_url, cover_url, tagline",
      )
      .eq("public_id", base.id)
      .maybeSingle(),
    sb
      .from("vendor_profiles")
      .select("*")
      .eq("vendor_public_id", base.id)
      .maybeSingle(),
  ]);

  const policies = (profile?.policies || {}) as Record<string, unknown>;
  const storefront = defaultStorefront(policies.storefront);
  const socials = (profile?.socials || {}) as Record<string, string>;

  return {
    ...base,
    name: String(profile?.display_name || vendor?.name || base.name),
    displayName: String(profile?.display_name || vendor?.name || base.name),
    tagline: String(vendor?.tagline || base.tagline || ""),
    description: String(
      profile?.description || vendor?.description || base.tagline || "",
    ),
    story: String(profile?.story || ""),
    logoUrl: String(profile?.logo_url || vendor?.logo_url || ""),
    bannerUrl: String(
      profile?.banner_url || vendor?.cover_url || base.coverImage || "",
    ),
    themeColor: String(profile?.theme_color || "#0a0a0a"),
    contactEmail: String(profile?.contact_email || vendor?.contact_email || ""),
    contactPhone: String(profile?.contact_phone || vendor?.contact_phone || ""),
    whatsapp: String(profile?.whatsapp || ""),
    city: String(vendor?.city || ""),
    specialty: String(vendor?.specialty || ""),
    neighbourhood: String(vendor?.neighbourhood || base.neighbourhood || ""),
    address: vendor?.address_text || base.address,
    socials,
    policies: {
      returns:
        typeof policies.returns === "string" ? policies.returns : undefined,
      ...policies,
    },
    storefront,
    coverImage: String(
      profile?.banner_url || vendor?.cover_url || base.coverImage || "",
    ),
  };
}

export async function getPublicVendorLocations(
  vendorPublicId: string,
): Promise<PublicBranch[]> {
  const sb = getServiceSupabase();
  const { data: vendor } = await sb
    .from("vendors")
    .select("id")
    .eq("public_id", vendorPublicId)
    .maybeSingle();
  if (!vendor) return [];

  const { data, error } = await sb
    .from("stores")
    .select(
      "id, public_id, name, neighbourhood, address_text, phone, lat, lng, is_primary",
    )
    .eq("vendor_id", vendor.id)
    .order("is_primary", { ascending: false });
  if (error || !data) return [];

  return data.map((s) => ({
    id: String(s.id),
    publicId: String(s.public_id),
    name: String(s.name),
    neighbourhood: s.neighbourhood ? String(s.neighbourhood) : null,
    address: s.address_text ? String(s.address_text) : null,
    phone: s.phone ? String(s.phone) : null,
    lat: s.lat != null ? Number(s.lat) : null,
    lng: s.lng != null ? Number(s.lng) : null,
    isPrimary: !!s.is_primary,
  }));
}

export async function getPublicVendorHours(
  vendorPublicId: string,
): Promise<PublicStoreHours[]> {
  const locations = await getPublicVendorLocations(vendorPublicId);
  if (!locations.length) return [];

  const sb = getServiceSupabase();
  const { data: rows } = await sb
    .from("store_hours")
    .select("*")
    .eq("vendor_public_id", vendorPublicId);

  const byStore = new Map<string, typeof rows>();
  for (const r of rows || []) {
    const key = String(r.store_public_id);
    const list = byStore.get(key) || [];
    list.push(r);
    byStore.set(key, list);
  }

  return locations.map((loc) => {
    const storeRows = byStore.get(loc.publicId) || [];
    const weekly: PublicDayHours[] = [0, 1, 2, 3, 4, 5, 6].map((d) => {
      const row = storeRows.find((r) => r.day_of_week === d && !r.holiday_date);
      return {
        dayOfWeek: d,
        openTime: row?.open_time ? String(row.open_time).slice(0, 5) : "09:00",
        closeTime: row?.close_time
          ? String(row.close_time).slice(0, 5)
          : "18:00",
        isClosed: row ? !!row.is_closed : d === 0,
      };
    });
    const holidays: PublicHolidayHours[] = storeRows
      .filter((r) => !!r.holiday_date)
      .map((r) => ({
        date: String(r.holiday_date).slice(0, 10),
        label: String(r.holiday_label || "Holiday"),
        openTime: r.open_time ? String(r.open_time).slice(0, 5) : null,
        closeTime: r.close_time ? String(r.close_time).slice(0, 5) : null,
        isClosed: r.is_closed !== false,
      }));
    const { openNow, todayLabel } = computeOpenNow(weekly, holidays);
    return {
      storePublicId: loc.publicId,
      storeName: loc.name,
      weekly,
      holidays,
      openNow,
      todayLabel,
    };
  });
}

export async function getPublicVendorReviews(vendorPublicId: string) {
  const { reviews, products } = await listVendorReviews([vendorPublicId]);
  const approved = reviews.filter((r) => !r.status || r.status === "approved");
  const productMap = new Map(products.map((p) => [p.publicId, p]));
  const avg =
    approved.length > 0
      ? approved.reduce((s, r) => s + r.rating, 0) / approved.length
      : 0;
  const distribution = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: approved.filter((r) => r.rating === stars).length,
  }));

  return {
    summary: {
      count: approved.length,
      average: Math.round(avg * 10) / 10,
      distribution,
    },
    reviews: approved.map((r) => ({
      id: r.id,
      productId: r.productId,
      productName: productMap.get(r.productId)?.name || "Product",
      productImage: productMap.get(r.productId)?.imageUrl || null,
      userName: r.userName,
      rating: r.rating,
      title: r.title,
      comment: r.comment,
      verifiedPurchase: r.verifiedPurchase,
      createdAt: r.createdAt,
      answers: r.answers || [],
    })),
  };
}

export async function getPublicVendorQuestions(vendorPublicId: string) {
  const { questions, products } = await listVendorQuestions([vendorPublicId]);
  const productMap = new Map(products.map((p) => [p.publicId, p]));
  return questions.map((q) => ({
    id: q.id,
    productId: q.productId,
    productName: productMap.get(q.productId)?.name || "Product",
    userName: q.userName,
    question: q.question,
    answers: (q.answers || []).map((a) => ({
      id: a.id,
      userName: a.userName,
      answer: a.answer,
      createdAt: a.createdAt,
    })),
    createdAt: q.createdAt,
  }));
}

export async function getVendorStorefrontBundle(slug: string) {
  const vendor = await getPublicVendorProfile(slug);
  if (!vendor) return null;

  const [products, locations, hours, reviews, questions] = await Promise.all([
    getVendorProducts(vendor),
    vendor.storefront.showLocations !== false
      ? getPublicVendorLocations(vendor.id)
      : Promise.resolve([] as PublicBranch[]),
    vendor.storefront.showHours !== false
      ? getPublicVendorHours(vendor.id)
      : Promise.resolve([] as PublicStoreHours[]),
    vendor.storefront.showReviews !== false
      ? getPublicVendorReviews(vendor.id)
      : Promise.resolve(null),
    vendor.storefront.showReviews !== false
      ? getPublicVendorQuestions(vendor.id)
      : Promise.resolve([]),
  ]);

  const primaryHours =
    hours.find((h) =>
      locations.some((l) => l.isPrimary && l.publicId === h.storePublicId),
    ) ||
    hours[0] ||
    null;

  const categoryCounts = new Map<string, number>();
  for (const p of products) {
    const c = (p as { category?: string }).category;
    if (!c) continue;
    categoryCounts.set(c, (categoryCounts.get(c) || 0) + 1);
  }
  const categories = [...categoryCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return {
    vendor,
    products,
    locations,
    hours,
    primaryHours,
    reviews,
    questions,
    categories,
  };
}
