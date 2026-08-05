"use client";

import { useCallback, useMemo } from "react";
import { SearchBox } from "@mapbox/search-js-react";
import type { SearchBoxRetrieveResponse } from "@mapbox/search-js-core";
import type mapboxgl from "mapbox-gl";
import { getMapboxToken, NAIROBI_CENTER } from "@/lib/mapbox";
import type { MapCommerceVendor } from "@/lib/map-commerce-types";
import { cn } from "@/lib/utils";
import "./advanced-map-search.css";

/** Nairobi metro bias box */
const NAIROBI_BBOX: [number, number, number, number] = [
  36.65, -1.45, 37.05, -1.15,
];

export type AdvancedSearchPlace = {
  id: string;
  lng: number;
  lat: number;
  name: string;
  address: string;
  featureType: string;
};

type AdvancedMapSearchProps = {
  className?: string;
  value?: string;
  placeholder?: string;
  map?: mapboxgl.Map | null;
  proximity?: { lng: number; lat: number } | null;
  vendors?: MapCommerceVendor[];
  onChange?: (value: string) => void;
  onPlaceSelect?: (place: AdvancedSearchPlace) => void;
  onVendorSelect?: (vendorId: string) => void;
  onCategorySelect?: (categoryId: string, label: string) => void;
  onClear?: () => void;
};

const SEARCH_THEME = {
  variables: {
    fontFamily: "inherit",
    unit: "14px",
    padding: "0.75em",
    borderRadius: "0",
    boxShadow: "none",
    border: "0",
    colorBackground: "transparent",
    colorBackgroundHover: "rgba(0,0,0,0.04)",
    colorBackgroundActive: "rgba(0,0,0,0.07)",
    colorText: "#0a0a0a",
    colorPrimary: "#0a0a0a",
    colorSecondary: "rgba(0,0,0,0.45)",
    colorBackdrop: "rgba(0,0,0,0.25)",
  },
  css: `
    .Input { background: transparent !important; border: 0 !important; box-shadow: none !important; }
    .Results { border-radius: 0 !important; border: 1px solid rgba(255,255,255,0.45) !important;
      background: rgba(255,255,255,0.94) !important; backdrop-filter: blur(20px); box-shadow: none !important;
      scrollbar-width: none !important; }
    .Results::-webkit-scrollbar { display: none !important; width: 0 !important; }
    .ResultsAttribute { letter-spacing: 0.12em; text-transform: uppercase; font-size: 10px; }
  `,
};

function vendorSuggestions(vendors: MapCommerceVendor[], query: string) {
  const q = query.toLowerCase().trim();
  if (q.length < 1) return [];
  return vendors
    .filter((v) => {
      const hay = [
        v.name,
        v.neighbourhood,
        v.tagline,
        v.address,
        v.primaryCategory,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    })
    .slice(0, 8)
    .map((v) => ({
      name: v.name,
      name_preferred: v.name,
      place_formatted:
        [v.neighbourhood, v.primaryCategory || "Vendor", "KlikCollect"]
          .filter(Boolean)
          .join(" · "),
      full_address: v.address || v.neighbourhood || v.name,
      mapbox_id: `vendor_${v.id}`,
      feature_type: "poi",
      poi_category: [v.primaryCategory || "shop"],
      maki: "shop",
      language: "en",
      _geometry: {
        type: "Point" as const,
        coordinates: [v.lng, v.lat] as [number, number],
      },
    }));
}

export default function AdvancedMapSearch({
  className,
  value = "",
  placeholder = "Search Nairobi — places, streets, shops…",
  map = null,
  proximity = null,
  vendors = [],
  onChange,
  onPlaceSelect,
  onVendorSelect,
  onCategorySelect,
  onClear,
}: AdvancedMapSearchProps) {
  const token = getMapboxToken();

  const prox = useMemo(
    () =>
      proximity
        ? { lng: proximity.lng, lat: proximity.lat }
        : { lng: NAIROBI_CENTER[0], lat: NAIROBI_CENTER[1] },
    [proximity?.lng, proximity?.lat],
  );

  const customSearch = useCallback(
    // Mapbox customSearch accepts suggestion-shaped objects + `_geometry`
    async (text: string) => vendorSuggestions(vendors, text) as never,
    [vendors],
  );

  const handleRetrieve = useCallback(
    (res: SearchBoxRetrieveResponse) => {
      const feature = res.features?.[0];
      if (!feature) return;

      const props = (feature.properties || {}) as unknown as Record<
        string,
        unknown
      >;
      const coords = feature.geometry?.coordinates as
        | [number, number]
        | undefined;
      const mapboxId = String(props.mapbox_id || props.mapboxId || "");
      const name = String(props.name || props.name_preferred || "Place");
      const address = String(
        props.full_address || props.place_formatted || name,
      );
      const featureType = String(props.feature_type || "place");

      if (mapboxId.startsWith("vendor_")) {
        onVendorSelect?.(mapboxId.slice("vendor_".length));
        return;
      }

      if (featureType === "category") {
        const catId =
          String(props.canonical_id || props.id || "").trim() ||
          name.toLowerCase().replace(/\s+/g, "_");
        onCategorySelect?.(catId, name);
        return;
      }

      if (!coords) return;
      onPlaceSelect?.({
        id: mapboxId || `place_${coords[0]}_${coords[1]}`,
        lng: coords[0],
        lat: coords[1],
        name,
        address,
        featureType,
      });
    },
    [onPlaceSelect, onVendorSelect, onCategorySelect],
  );

  if (!token) {
    return (
      <div
        className={cn(
          "px-4 py-3 text-[13px] text-black/45",
          className,
        )}
      >
        Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to enable search.
      </div>
    );
  }

  return (
    <div className={cn("kc-advanced-search", className)}>
      <SearchBox
        accessToken={token}
        value={value}
        onChange={(v) => onChange?.(v)}
        onClear={() => onClear?.()}
        onRetrieve={handleRetrieve}
        placeholder={placeholder}
        map={map || undefined}
        mapboxgl={undefined}
        marker={false}
        theme={SEARCH_THEME}
        popoverOptions={{ placement: "bottom-start", offset: 8, flip: true }}
        options={{
          language: "en",
          country: "ke",
          limit: 10,
          // Cast: Search Box API accepts poi + category beyond the typed admin units
          types:
            "country,region,postcode,district,place,city,locality,neighborhood,street,address,poi,category" as never,
          proximity: prox,
          bbox: NAIROBI_BBOX,
          ...(proximity
            ? {
                origin: prox,
                navigation_profile: "driving" as const,
                eta_type: "navigation" as const,
              }
            : {}),
        }}
        componentOptions={{
          allowReverse: true,
          flyTo: false,
          customSearch,
        }}
      />
    </div>
  );
}
