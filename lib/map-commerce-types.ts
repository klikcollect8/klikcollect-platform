/**
 * Client-safe commerce map types + GeoJSON helpers.
 * Keep server data loaders out of this file (no fs / stores).
 */

export type MapCommerceProduct = {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  image: string;
};

export type MapCommerceVendor = {
  id: string;
  name: string;
  slug: string;
  neighbourhood: string;
  address: string;
  tagline: string;
  categories: string[];
  primaryCategory: string;
  color: string;
  productCount: number;
  coverImage: string;
  lng: number;
  lat: number;
  rating: number;
  reviewCount: number;
  openNow: boolean;
  hoursLabel: string;
  pickupMinutes: number;
  deliveryMinutes: number;
  deliveryFee: number;
  minOrder: number;
  verified: boolean;
  featured: boolean;
  hasOffer: boolean;
  acceptsCard: boolean;
  acceptsMpesa: boolean;
  products: MapCommerceProduct[];
};

export type MapProductIndexEntry = {
  id: string;
  name: string;
  category: string;
  image: string;
  vendorIds: string[];
  minPrice: number;
  maxPrice: number;
};

export function vendorsToGeoJSON(
  vendors: MapCommerceVendor[],
  opts?: {
    highlightIds?: Set<string>;
    activeId?: string | null;
    hoveredId?: string | null;
  },
): GeoJSON.FeatureCollection {
  const highlight = opts?.highlightIds;
  return {
    type: "FeatureCollection",
    features: vendors.map((v, i) => ({
      type: "Feature",
      id: v.id,
      properties: {
        id: v.id,
        name: v.name,
        slug: v.slug,
        colour: v.color,
        rating: v.rating,
        openNow: v.openNow,
        featured: v.featured,
        verified: v.verified,
        hasOffer: v.hasOffer,
        pickupMinutes: v.pickupMinutes,
        primaryCategory: v.primaryCategory,
        index: i + 1,
        indexLabel: String(i + 1),
        highlighted: highlight ? highlight.has(v.id) : true,
        active: opts?.activeId === v.id,
        hovered: opts?.hoveredId === v.id,
        dimmed: highlight ? !highlight.has(v.id) : false,
      },
      geometry: {
        type: "Point",
        coordinates: [v.lng, v.lat],
      },
    })),
  };
}
