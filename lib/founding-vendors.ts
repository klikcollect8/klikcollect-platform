/**
 * Seed-input founding cohort only.
 * Runtime storefront/OS reads vendors from Supabase (`getAdmittedVendors`).
 * Consumed by `scripts/seed-supabase-catalogue.ts`.
 */

export type FoundingBranch = {
  /** Suffix for store public_id: sto_{vendorSlug}_{id} */
  id: string;
  name: string;
  neighbourhood: string;
  address: string;
  lng: number;
  lat: number;
  phone?: string;
};

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
  /** Extra collect points beyond the primary store */
  branches?: FoundingBranch[];
};

/**
 * Pickup points - neighbourhood centroids from Mapbox Search (live geocode)
 * with curated fallbacks for localities Mapbox resolves only to Nairobi CBD.
 * Each brand has a small Nairobi network of collect points.
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
    branches: [
      {
        id: "gigiri",
        name: "Gigiri Market Counter",
        neighbourhood: "Gigiri",
        address: "Limuru Road, Gigiri, Nairobi",
        lng: 36.8052,
        lat: -1.2328,
        phone: "+254 700 111 201",
      },
      {
        id: "kileleshwa",
        name: "Kileleshwa Fresh Desk",
        neighbourhood: "Kileleshwa",
        address: "Oloitoktok Road, Kileleshwa, Nairobi",
        lng: 36.7785,
        lat: -1.2832,
        phone: "+254 700 111 202",
      },
      {
        id: "southc",
        name: "South C Produce Hub",
        neighbourhood: "South C",
        address: "Muhoho Avenue, South C, Nairobi",
        lng: 36.8251,
        lat: -1.3168,
        phone: "+254 700 111 203",
      },
    ],
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
    branches: [
      {
        id: "lavington",
        name: "Lavington Creamery",
        neighbourhood: "Lavington",
        address: "James Gichuru Road, Lavington, Nairobi",
        lng: 36.7728,
        lat: -1.2764,
        phone: "+254 700 222 201",
      },
      {
        id: "runda",
        name: "Runda Farm Counter",
        neighbourhood: "Runda",
        address: "Runda Grove, Runda, Nairobi",
        lng: 36.7984,
        lat: -1.2186,
        phone: "+254 700 222 202",
      },
    ],
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
    branches: [
      {
        id: "westlands",
        name: "Westlands Pantry",
        neighbourhood: "Westlands",
        address: "Ring Road Parklands, Westlands, Nairobi",
        lng: 36.8092,
        lat: -1.2658,
        phone: "+254 700 333 201",
      },
      {
        id: "kilimani",
        name: "Kilimani Staples Desk",
        neighbourhood: "Kilimani",
        address: "Argwings Kodhek Road, Kilimani, Nairobi",
        lng: 36.7851,
        lat: -1.2894,
        phone: "+254 700 333 202",
      },
      {
        id: "hurlingham",
        name: "Hurlingham Dry Goods",
        neighbourhood: "Hurlingham",
        address: "Argwings Kodhek Road, Hurlingham, Nairobi",
        lng: 36.7905,
        lat: -1.2936,
        phone: "+254 700 333 203",
      },
    ],
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
    branches: [
      {
        id: "cbd",
        name: "CBD Sip Bar",
        neighbourhood: "Nairobi CBD",
        address: "Kimathi Street, Nairobi CBD",
        lng: 36.8215,
        lat: -1.2836,
        phone: "+254 700 444 201",
      },
      {
        id: "riverside",
        name: "Riverside Brew Counter",
        neighbourhood: "Riverside",
        address: "Riverside Drive, Nairobi",
        lng: 36.8042,
        lat: -1.2695,
        phone: "+254 700 444 202",
      },
      {
        id: "parklands",
        name: "Parklands Tea Desk",
        neighbourhood: "Parklands",
        address: "3rd Parklands Avenue, Parklands, Nairobi",
        lng: 36.8118,
        lat: -1.2629,
        phone: "+254 700 444 203",
      },
    ],
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
    branches: [
      {
        id: "yaya",
        name: "Yaya Snacks Kiosk",
        neighbourhood: "Kilimani",
        address: "Yaya Centre, Argwings Kodhek Road, Nairobi",
        lng: 36.7872,
        lat: -1.2921,
        phone: "+254 700 555 201",
      },
      {
        id: "westlands",
        name: "Westlands Crunch Desk",
        neighbourhood: "Westlands",
        address: "Waiyaki Way, Westlands, Nairobi",
        lng: 36.8076,
        lat: -1.2689,
        phone: "+254 700 555 202",
      },
    ],
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
    branches: [
      {
        id: "karen",
        name: "Karen Atelier",
        neighbourhood: "Karen",
        address: "Karen Road, Karen, Nairobi",
        lng: 36.7082,
        lat: -1.3254,
        phone: "+254 700 666 201",
      },
      {
        id: "lavington",
        name: "Lavington Tools Desk",
        neighbourhood: "Lavington",
        address: "Riara Road, Lavington, Nairobi",
        lng: 36.7689,
        lat: -1.2796,
        phone: "+254 700 666 202",
      },
      {
        id: "spring-valley",
        name: "Spring Valley Studio",
        neighbourhood: "Spring Valley",
        address: "Lower Kabete Road, Spring Valley, Nairobi",
        lng: 36.7812,
        lat: -1.2548,
        phone: "+254 700 666 203",
      },
    ],
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
    branches: [
      {
        id: "embakasi",
        name: "Embakasi Clean Hub",
        neighbourhood: "Embakasi",
        address: "Outer Ring Road, Embakasi, Nairobi",
        lng: 36.8912,
        lat: -1.3184,
        phone: "+254 700 777 201",
      },
      {
        id: "ngong",
        name: "Ngong Road Refill Desk",
        neighbourhood: "Ngong Road",
        address: "Ngong Road, Nairobi",
        lng: 36.7805,
        lat: -1.3012,
        phone: "+254 700 777 202",
      },
    ],
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
    branches: [
      {
        id: "westlands",
        name: "Westlands Apothecary",
        neighbourhood: "Westlands",
        address: "General Mathenge Drive, Westlands, Nairobi",
        lng: 36.8048,
        lat: -1.2615,
        phone: "+254 700 888 201",
      },
      {
        id: "kilimani",
        name: "Kilimani Wellness Desk",
        neighbourhood: "Kilimani",
        address: "Kindaruma Road, Kilimani, Nairobi",
        lng: 36.7868,
        lat: -1.2908,
        phone: "+254 700 888 202",
      },
      {
        id: "rosslyn",
        name: "Rosslyn Care Point",
        neighbourhood: "Rosslyn",
        address: "Limuru Road, Rosslyn, Nairobi",
        lng: 36.7924,
        lat: -1.2218,
        phone: "+254 700 888 203",
      },
    ],
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
    branches: [
      {
        id: "eastleigh",
        name: "Eastleigh Basket",
        neighbourhood: "Eastleigh",
        address: "General Waruingi Street, Eastleigh, Nairobi",
        lng: 36.8486,
        lat: -1.2738,
        phone: "+254 700 999 201",
      },
      {
        id: "southb",
        name: "South B Grocer Desk",
        neighbourhood: "South B",
        address: "Muindi Mbingu Road, South B, Nairobi",
        lng: 36.8382,
        lat: -1.3124,
        phone: "+254 700 999 202",
      },
      {
        id: "parklands",
        name: "Parklands Weekly Basket",
        neighbourhood: "Parklands",
        address: "Ojijo Road, Parklands, Nairobi",
        lng: 36.8145,
        lat: -1.2612,
        phone: "+254 700 999 203",
      },
    ],
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
    branches: [
      {
        id: "westlands",
        name: "Westlands Essentials",
        neighbourhood: "Westlands",
        address: "Parklands Road, Westlands, Nairobi",
        lng: 36.8124,
        lat: -1.2667,
        phone: "+254 700 101 201",
      },
      {
        id: "southc",
        name: "South C Staples Desk",
        neighbourhood: "South C",
        address: "Popo Road, South C, Nairobi",
        lng: 36.8298,
        lat: -1.3201,
        phone: "+254 700 101 202",
      },
    ],
  },
];

/** Flatten primary + branches for a vendor (primary first). */
export function foundingVendorStores(v: FoundingVendor): Array<{
  publicId: string;
  name: string;
  neighbourhood: string;
  address: string;
  lng: number;
  lat: number;
  phone: string | null;
  isPrimary: boolean;
}> {
  const primary = {
    publicId: `sto_${v.slug}`,
    name: `${v.name} · ${v.neighbourhood}`,
    neighbourhood: v.neighbourhood,
    address: v.address,
    lng: v.lng,
    lat: v.lat,
    phone: null as string | null,
    isPrimary: true,
  };
  const extras = (v.branches || []).map((b) => ({
    publicId: `sto_${v.slug}_${b.id}`,
    name: b.name,
    neighbourhood: b.neighbourhood,
    address: b.address,
    lng: b.lng,
    lat: b.lat,
    phone: b.phone || null,
    isPrimary: false,
  }));
  return [primary, ...extras];
}

export function vendorBySlug(slug: string): FoundingVendor | undefined {
  return FOUNDING_VENDORS.find((v) => v.slug === slug);
}

export function vendorByName(name: string): FoundingVendor | undefined {
  return FOUNDING_VENDORS.find(
    (v) => v.name.toLowerCase() === name.trim().toLowerCase(),
  );
}

export function vendorForCategory(
  category: string,
): FoundingVendor | undefined {
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
