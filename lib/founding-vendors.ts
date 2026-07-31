/** Shared founding-cohort vendor directory for storefront + seed. */

export type FoundingVendor = {
  id: string;
  name: string;
  slug: string;
  neighbourhood: string;
  email: string;
  tagline: string;
  /** Primary category this vendor specialises in */
  specialty: string;
};

export const FOUNDING_VENDORS: FoundingVendor[] = [
  {
    id: "ven_green_valley",
    name: "Green Valley Produce",
    slug: "green-valley-produce",
    neighbourhood: "Westlands",
    email: "hello@greenvalley.ke",
    tagline: "Farm-fresh fruit and vegetables, picked for pickup",
    specialty: "Fresh Produce",
  },
  {
    id: "ven_dairy_crest",
    name: "Dairy Crest Farmshop",
    slug: "dairy-crest-farmshop",
    neighbourhood: "Karen",
    email: "hello@dairycrest.ke",
    tagline: "Milk, eggs, cheese and cultured dairy from local farms",
    specialty: "Dairy & Eggs",
  },
  {
    id: "ven_pantry_house",
    name: "Pantry House",
    slug: "pantry-house",
    neighbourhood: "Lavington",
    email: "hello@pantry-house.ke",
    tagline: "Dry goods, oils and kitchen staples",
    specialty: "Pantry",
  },
  {
    id: "ven_sip_house",
    name: "Sip House",
    slug: "sip-house",
    neighbourhood: "Kilimani",
    email: "hello@siphouse.ke",
    tagline: "Juices, teas, coffee and everyday drinks",
    specialty: "Beverages",
  },
  {
    id: "ven_crunch_corner",
    name: "Crunch Corner",
    slug: "crunch-corner",
    neighbourhood: "Parklands",
    email: "hello@crunchcorner.ke",
    tagline: "Nuts, bars, chocolate and snack favourites",
    specialty: "Snacks",
  },
  {
    id: "ven_kitchen_atelier",
    name: "Kitchen Atelier",
    slug: "kitchen-atelier",
    neighbourhood: "Riverside",
    email: "hello@kitchenatelier.ke",
    tagline: "Cookware, ceramics and tools for the home kitchen",
    specialty: "Home & Kitchen",
  },
  {
    id: "ven_clean_living",
    name: "Clean Living KE",
    slug: "clean-living-ke",
    neighbourhood: "South C",
    email: "hello@cleanliving.ke",
    tagline: "Eco cleaning supplies for everyday home care",
    specialty: "Household Essentials",
  },
  {
    id: "ven_wellness_apothecary",
    name: "Wellness Apothecary",
    slug: "wellness-apothecary",
    neighbourhood: "Loresho",
    email: "hello@wellnessapothecary.ke",
    tagline: "Non-prescription wellness, skincare and first aid",
    specialty: "Health & Wellness (non-prescription)",
  },
  {
    id: "ven_everyday_basket",
    name: "Everyday Basket",
    slug: "everyday-basket",
    neighbourhood: "Ngong Road",
    email: "hello@everydaybasket.ke",
    tagline: "Bakery, fruit and grocery staples for the week",
    specialty: "Groceries",
  },
  {
    id: "ven_home_staples",
    name: "Home Staples",
    slug: "home-staples",
    neighbourhood: "Hurlingham",
    email: "hello@homestaples.ke",
    tagline: "Toiletries, paper goods and general home essentials",
    specialty: "General Essentials",
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
