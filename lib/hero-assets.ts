import { cmsImageUrl } from "@/lib/storage-urls";

/** Seed filenames — runtime URLs point at Supabase Storage (cms-images). */
export const HERO_SEED_FILES = [
  "hero-01.jpeg",
  "hero-02.jpeg",
  "hero-03.jpeg",
  "hero-04.jpeg",
  "hero-05.jpeg",
  "hero-06.jpeg",
  "hero-07.jpeg",
  "hero-08.jpeg",
  "hero-09.jpeg",
  "hero-10.jpeg",
] as const;

/** Storage-backed hero stills (fallback when CMS API is empty). */
export const HERO_ASSETS = HERO_SEED_FILES.map((file) =>
  cmsImageUrl(`hero/${file}`),
);

export const HERO_COPY = {
  eyebrow: "Shop",
  headline: "Find what you need.",
  sub: "Fresh picks. Ready when you are.",
  cta: "Shop now",
  ctaHref: "/shop",
} as const;
