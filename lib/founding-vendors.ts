/**
 * Seed-input founding cohort only.
 * Runtime storefront/OS reads vendors from Supabase (`getAdmittedVendors`).
 * Consumed by `scripts/seed-supabase-catalogue.ts`.
 */

export type FoundingVendor = {
  id: string;
  name: string;
  slug: string;
  neighbourhood: string;
  /** Street-level pickup address (searchable) */
  address: string;
  email: string;
  tagline: string;
  /** Primary category this vendor specialises in */
  specialty: string;
  /** Longitude (Mapbox / GeoJSON order companion) */
  lng: number;
  /** Latitude */
  lat: number;
};

/**
 * Pickup points — neighbourhood centroids from Mapbox Search (live geocode)
 * with curated fallbacks for localities Mapbox resolves only to Nairobi CBD.
 */
export const FOUNDING_VENDORS: FoundingVendor[] = [
  {
    id: "ven_green_valley",
    name: "Green Valley Produce",
    slug: "green-valley-produce",
    neighbourhood: "Westlands",
    address: "Mpaka Road, Westlands, Nairobi",
    email: "hello@greenvalley.ke",
    tagline: "Farm-fresh fruit and vegetables, picked for pickup",
    specialty: "Fresh Produce",
    lng: 36.8108,
    lat: -1.2675,
  },
  {
    id: "ven_dairy_crest",
    name: "Dairy Crest Farmshop",
    slug: "dairy-crest-farmshop",
    neighbourhood: "Karen",
    address: "Karen Road, Karen, Nairobi",
    email: "hello@dairycrest.ke",
    tagline: "Milk, eggs, cheese and cultured dairy from local farms",
    specialty: "Dairy & Eggs",
    lng: 36.704655,
    lat: -1.328293,
  },
  {
    id: "ven_pantry_house",
    name: "Pantry House",
    slug: "pantry-house",
    neighbourhood: "Lavington",
    address: "James Gichuru Road, Lavington, Nairobi",
    email: "hello@pantry-house.ke",
    tagline: "Dry goods, oils and kitchen staples",
    specialty: "Pantry",
    lng: 36.7753,
    lat: -1.2778,
  },
  {
    id: "ven_sip_house",
    name: "Sip House",
    slug: "sip-house",
    neighbourhood: "Kilimani",
    address: "Argwings Kodhek Road, Kilimani, Nairobi",
    email: "hello@siphouse.ke",
    tagline: "Juices, teas, coffee and everyday drinks",
    specialty: "Beverages",
    lng: 36.7834,
    lat: -1.287982,
  },
  {
    id: "ven_crunch_corner",
    name: "Crunch Corner",
    slug: "crunch-corner",
    neighbourhood: "Parklands",
    address: "3rd Parklands Avenue, Parklands, Nairobi",
    email: "hello@crunchcorner.ke",
    tagline: "Nuts, bars, chocolate and snack favourites",
    specialty: "Snacks",
    lng: 36.81003,
    lat: -1.26404,
  },
  {
    id: "ven_kitchen_atelier",
    name: "Kitchen Atelier",
    slug: "kitchen-atelier",
    neighbourhood: "Riverside",
    address: "Riverside Drive, Nairobi",
    email: "hello@kitchenatelier.ke",
    tagline: "Cookware, ceramics and tools for the home kitchen",
    specialty: "Home & Kitchen",
    lng: 36.8055,
    lat: -1.2708,
  },
  {
    id: "ven_clean_living",
    name: "Clean Living KE",
    slug: "clean-living-ke",
    neighbourhood: "South C",
    address: "Muhoho Avenue, South C, Nairobi",
    email: "hello@cleanliving.ke",
    tagline: "Eco cleaning supplies for everyday home care",
    specialty: "Household Essentials",
    lng: 36.82774,
    lat: -1.318839,
  },
  {
    id: "ven_wellness_apothecary",
    name: "Wellness Apothecary",
    slug: "wellness-apothecary",
    neighbourhood: "Loresho",
    address: "Loresho Ridge, Loresho, Nairobi",
    email: "hello@wellnessapothecary.ke",
    tagline: "Non-prescription wellness, skincare and first aid",
    specialty: "Health & Wellness (non-prescription)",
    lng: 36.752,
    lat: -1.2475,
  },
  {
    id: "ven_everyday_basket",
    name: "Everyday Basket",
    slug: "everyday-basket",
    neighbourhood: "Ngong Road",
    address: "Ngong Road, Nairobi",
    email: "hello@everydaybasket.ke",
    tagline: "Bakery, fruit and grocery staples for the week",
    specialty: "Groceries",
    lng: 36.782,
    lat: -1.3025,
  },
  {
    id: "ven_home_staples",
    name: "Home Staples",
    slug: "home-staples",
    neighbourhood: "Hurlingham",
    address: "Argwings Kodhek Road, Hurlingham, Nairobi",
    email: "hello@homestaples.ke",
    tagline: "Toiletries, paper goods and general home essentials",
    specialty: "General Essentials",
    lng: 36.789,
    lat: -1.292,
  },
];

export function vendorBySlug(slug: string): FoundingVendor | undefined {
  return FOUNDING_VENDORS.find((v) => v.slug === slug);
}

export function vendorByName(name: string): FoundingVendor | undefined {
  return FOUNDING_VENDORS.find(
    (v) => v.name.toLowerCase() === name.trim().toLowerCase(),
  );
}

export function vendorForCategory(category: string): FoundingVendor | undefined {
  return FOUNDING_VENDORS.find((v) => v.specialty === category);
}

export function vendorById(id: string): FoundingVendor | undefined {
  return FOUNDING_VENDORS.find((v) => v.id === id);
}

/** Resolve coordinates for a vendor id or neighbourhood label. */
export function resolveVendorCoords(input: {
  vendorId?: string;
  neighbourhood?: string;
}): { lng: number; lat: number } | null {
  if (input.vendorId) {
    const byId = vendorById(input.vendorId);
    if (byId) return { lng: byId.lng, lat: byId.lat };
  }
  if (input.neighbourhood) {
    const key = input.neighbourhood.trim().toLowerCase();
    const byHood = FOUNDING_VENDORS.find(
      (v) => v.neighbourhood.toLowerCase() === key,
    );
    if (byHood) return { lng: byHood.lng, lat: byHood.lat };
  }
  return null;
}

export function resolveVendorAddress(input: {
  vendorId?: string;
  neighbourhood?: string;
}): string | null {
  if (input.vendorId) {
    const byId = vendorById(input.vendorId);
    if (byId) return byId.address;
  }
  if (input.neighbourhood) {
    const key = input.neighbourhood.trim().toLowerCase();
    const byHood = FOUNDING_VENDORS.find(
      (v) => v.neighbourhood.toLowerCase() === key,
    );
    if (byHood) return byHood.address;
  }
  return null;
}
