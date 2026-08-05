"use client";

import { useCallback, useMemo, useState } from "react";
import { SearchBox } from "@mapbox/search-js-react";
import type { SearchBoxRetrieveResponse } from "@mapbox/search-js-core";
import { getMapboxToken, NAIROBI_CENTER } from "@/lib/mapbox";
import type { AddressSuggestion } from "@/lib/mapbox-search";
import { cn } from "@/lib/utils";
import "./advanced-map-search.css";

type MapSearchBoxProps = {
  className?: string;
  placeholder?: string;
  proximity?: { lng: number; lat: number } | null;
  onSelect: (hit: AddressSuggestion & { lng: number; lat: number }) => void;
};

const THEME = {
  variables: {
    fontFamily: "inherit",
    unit: "14px",
    padding: "0.8em",
    borderRadius: "0",
    boxShadow: "none",
    border: "1px solid rgba(0,0,0,0.1)",
    colorBackground: "rgba(255,255,255,0.95)",
    colorBackgroundHover: "rgba(0,0,0,0.04)",
    colorText: "#0a0a0a",
    colorPrimary: "#0a0a0a",
    colorSecondary: "rgba(0,0,0,0.45)",
  },
};

export default function MapSearchBox({
  className,
  placeholder = "Search places in Nairobi",
  proximity,
  onSelect,
}: MapSearchBoxProps) {
  const [value, setValue] = useState("");
  const token = getMapboxToken();

  const prox = useMemo(
    () =>
      proximity
        ? { lng: proximity.lng, lat: proximity.lat }
        : { lng: NAIROBI_CENTER[0], lat: NAIROBI_CENTER[1] },
    [proximity?.lng, proximity?.lat],
  );

  const handleRetrieve = useCallback(
    (res: SearchBoxRetrieveResponse) => {
      const feature = res.features?.[0];
      if (!feature?.geometry?.coordinates) return;
      const [lng, lat] = feature.geometry.coordinates as [number, number];
      const props = (feature.properties || {}) as unknown as Record<
        string,
        unknown
      >;
      const name = String(props.name || "Place");
      const fullAddress = String(
        props.full_address || props.place_formatted || name,
      );
      const mapboxId = String(props.mapbox_id || `${lng},${lat}`);
      setValue(name);
      onSelect({
        id: `addr_${mapboxId}`,
        mapboxId,
        name,
        fullAddress,
        featureType: String(props.feature_type || "place"),
        lng,
        lat,
      });
    },
    [onSelect],
  );

  if (!token) {
    return (
      <p className={cn("px-3 py-2 text-[13px] text-black/40", className)}>
        Map search unavailable
      </p>
    );
  }

  return (
    <div className={cn("kc-advanced-search", className)}>
      <SearchBox
        accessToken={token}
        value={value}
        onChange={setValue}
        onClear={() => setValue("")}
        onRetrieve={handleRetrieve}
        placeholder={placeholder}
        marker={false}
        theme={THEME}
        options={{
          language: "en",
          country: "ke",
          limit: 8,
          proximity: prox,
          types:
            "place,locality,neighborhood,street,address,poi" as never,
        }}
        componentOptions={{ allowReverse: true, flyTo: false }}
      />
    </div>
  );
}
