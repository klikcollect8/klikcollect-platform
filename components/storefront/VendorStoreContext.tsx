"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Product } from "@/types";

export type VendorStorefrontSettings = {
  announcement?: string;
  highlight?: string;
  showReviews?: boolean;
  showLocations?: boolean;
  showHours?: boolean;
  showStory?: boolean;
  featuredCategory?: string;
};

export type VendorProfile = {
  id: string;
  name: string;
  displayName: string;
  slug: string;
  neighbourhood: string;
  city: string;
  specialty: string;
  tagline: string;
  description: string;
  story: string;
  logoUrl: string;
  bannerUrl: string;
  coverImage: string;
  themeColor: string;
  contactEmail: string;
  contactPhone: string;
  whatsapp: string;
  productCount: number;
  categories: string[];
  socials: Record<string, string>;
  policies: { returns?: string; [key: string]: unknown };
  storefront: VendorStorefrontSettings;
};

export type VendorBranch = {
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

export type VendorHours = {
  storePublicId: string;
  storeName: string;
  weekly: Array<{
    dayOfWeek: number;
    openTime: string | null;
    closeTime: string | null;
    isClosed: boolean;
  }>;
  holidays: Array<{
    date: string;
    label: string;
    openTime: string | null;
    closeTime: string | null;
    isClosed: boolean;
  }>;
  openNow: boolean;
  todayLabel: string;
};

export type VendorReviewSummary = {
  count: number;
  average: number;
  distribution: Array<{ stars: number; count: number }>;
};

export type VendorReview = {
  id: string;
  productId: string;
  productName: string;
  productImage: string | null;
  userName: string;
  rating: number;
  title: string;
  comment: string;
  verifiedPurchase: boolean;
  createdAt: string;
  answers: Array<{
    id: string;
    userName: string;
    answer: string;
    createdAt: string;
  }>;
};

export type VendorQuestion = {
  id: string;
  productId: string;
  productName: string;
  userName: string;
  question: string;
  answers: Array<{
    id: string;
    userName: string;
    answer: string;
    createdAt: string;
  }>;
  createdAt: string;
};

export type VendorCategory = { name: string; count: number };

export type VendorProduct = Product & { offerId?: string; price?: number };

type VendorStoreState = {
  slug: string;
  loading: boolean;
  notFound: boolean;
  vendor: VendorProfile | null;
  products: VendorProduct[];
  locations: VendorBranch[];
  hours: VendorHours[];
  primaryHours: VendorHours | null;
  reviews: { summary: VendorReviewSummary; reviews: VendorReview[] } | null;
  questions: VendorQuestion[];
  categories: VendorCategory[];
  accent: string;
};

const emptyState = {
  loading: true,
  notFound: false,
  vendor: null as VendorProfile | null,
  products: [] as VendorProduct[],
  locations: [] as VendorBranch[],
  hours: [] as VendorHours[],
  primaryHours: null as VendorHours | null,
  reviews: null as VendorStoreState["reviews"],
  questions: [] as VendorQuestion[],
  categories: [] as VendorCategory[],
};

const VendorStoreContext = createContext<VendorStoreState | null>(null);

export function VendorStoreProvider({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  const [state, setState] = useState(emptyState);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    const load = async () => {
      try {
        const r = await fetch(`/api/vendors/${encodeURIComponent(slug)}`);
        if (cancelled) return;
        if (r.status === 404) {
          setState({
            ...emptyState,
            loading: false,
            notFound: true,
          });
          return;
        }
        const payload = await r.json();
        if (cancelled) return;
        const d = payload?.data;
        if (!d?.vendor) {
          setState((s) => ({ ...s, loading: false, notFound: true }));
          return;
        }
        setState({
          loading: false,
          notFound: false,
          vendor: d.vendor,
          products: Array.isArray(d.products) ? d.products : [],
          locations: Array.isArray(d.locations) ? d.locations : [],
          hours: Array.isArray(d.hours) ? d.hours : [],
          primaryHours: d.primaryHours || null,
          reviews: d.reviews || null,
          questions: Array.isArray(d.questions) ? d.questions : [],
          categories: Array.isArray(d.categories) ? d.categories : [],
        });
      } catch {
        if (!cancelled) {
          setState({
            ...emptyState,
            loading: false,
            notFound: true,
          });
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const value = useMemo<VendorStoreState>(
    () => ({
      slug,
      ...state,
      accent: state.vendor?.themeColor || "#0a0a0a",
    }),
    [slug, state],
  );

  return (
    <VendorStoreContext.Provider value={value}>
      {children}
    </VendorStoreContext.Provider>
  );
}

export function useVendorStore() {
  const ctx = useContext(VendorStoreContext);
  if (!ctx) {
    throw new Error("useVendorStore must be used within VendorStoreProvider");
  }
  return ctx;
}
