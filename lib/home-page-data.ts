/**
 * Server-only homepage payload — one round-trip, shared caches.
 */
import { unstable_cache } from "next/cache";
import { getAdmittedVendors } from "@/lib/admitted-vendors";
import { getHomeCatalogue } from "@/lib/commerce-truth";
import { HERO_ASSETS, HERO_COPY } from "@/lib/hero-assets";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export type HomeHero = {
  eyebrow: string;
  headline: string;
  sub: string;
  cta: string;
  ctaHref: string;
  images: string[];
};

export type HomeVendorCard = {
  id: string;
  name: string;
  slug: string;
  neighbourhood: string;
  tagline: string;
};

const getCachedHero = unstable_cache(
  async (): Promise<HomeHero> => {
    try {
      const admin = createAdminClient();
      const supabase = admin || (await createClient());

      const [settingsRes, slidesRes] = await Promise.all([
        supabase
          .from("homepage_settings")
          .select("settings")
          .eq("id", 1)
          .maybeSingle(),
        supabase
          .from("banner_slides")
          .select("image_url, eyebrow, headline, sub, cta_label, cta_href")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
      ]);

      const s = (settingsRes.data?.settings || {}) as Record<string, unknown>;
      const slides = (slidesRes.data || []) as Array<{
        image_url?: string | null;
        eyebrow?: string | null;
        headline?: string | null;
        sub?: string | null;
        cta_label?: string | null;
        cta_href?: string | null;
      }>;
      const fromSlides = slides
        .map((row) => (row.image_url ? String(row.image_url) : ""))
        .filter(Boolean);
      const fromSettings = Array.isArray(s.heroImages)
        ? s.heroImages.map(String).filter(Boolean)
        : [];

      const firstSlide = slides[0];
      return {
        eyebrow: String(
          firstSlide?.eyebrow || s.eyebrow || HERO_COPY.eyebrow,
        ),
        headline: String(
          firstSlide?.headline || s.headline || HERO_COPY.headline,
        ),
        sub: String(firstSlide?.sub || s.sub || HERO_COPY.sub),
        cta: String(
          firstSlide?.cta_label || s.cta || HERO_COPY.cta,
        ),
        ctaHref: String(
          firstSlide?.cta_href || s.ctaHref || HERO_COPY.ctaHref,
        ),
        images:
          fromSlides.length > 0
            ? fromSlides
            : fromSettings.length > 0
              ? fromSettings
              : [...HERO_ASSETS],
      };
    } catch {
      return {
        eyebrow: HERO_COPY.eyebrow,
        headline: HERO_COPY.headline,
        sub: HERO_COPY.sub,
        cta: HERO_COPY.cta,
        ctaHref: HERO_COPY.ctaHref,
        images: [...HERO_ASSETS],
      };
    }
  },
  ["home-hero-v1"],
  { revalidate: 60, tags: ["homepage"] },
);

const getCachedVendorCards = unstable_cache(
  async (): Promise<HomeVendorCard[]> => {
    const vendors = await getAdmittedVendors();
    return vendors.slice(0, 6).map((v) => ({
      id: v.id,
      name: v.name,
      slug: v.slug,
      neighbourhood: v.neighbourhood,
      tagline: v.tagline,
    }));
  },
  ["home-vendors-v1"],
  { revalidate: 60, tags: ["vendors"] },
);

export async function getHomePageData(productLimit = 48) {
  const [catalogue, hero, vendors] = await Promise.all([
    getHomeCatalogue(productLimit),
    getCachedHero(),
    getCachedVendorCards(),
  ]);
  return {
    products: catalogue.products,
    categories: catalogue.categories,
    hero,
    vendors,
  };
}
