"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { MapPin, Navigation } from "lucide-react";
import {
  buildStaticMapUrl,
  getMapboxToken,
  MAPBOX_FLAT_STYLE,
  MAP_FLAT_ZOOM,
} from "@/lib/mapbox";
import {
  resolveVendorAddress,
  resolveVendorCoords,
  vendorById,
} from "@/lib/founding-vendors";
import { resolveVendorSlug } from "@/lib/vendor-slug";
import type { MapMarker } from "@/components/map/MapCanvas";

const MapCanvas = dynamic(() => import("@/components/map/MapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[280px] items-center justify-center bg-black/[0.03] text-[11px] uppercase tracking-[0.2em] text-black/35">
      Loading map
    </div>
  ),
});

export type PreviewOfferPin = {
  id: string;
  vendorId: string;
  vendorName: string;
  neighbourhood?: string;
  address?: string;
  lng?: number;
  lat?: number;
};

type MapPreviewProps = {
  offers: PreviewOfferPin[];
  selectedOfferId?: string | null;
  className?: string;
  variant?: "panel" | "tab";
};

/**
 * Uber-style flat 2D pickup map — exact vendor pin, no 3D tilt.
 */
export default function MapPreview({
  offers,
  selectedOfferId,
  className,
  variant = "tab",
}: MapPreviewProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [useGl, setUseGl] = useState(true);
  const hasToken = !!getMapboxToken();

  const pins = useMemo(() => {
    return offers
      .map((o) => {
        const resolved =
          o.lng != null && o.lat != null
            ? { lng: o.lng, lat: o.lat }
            : resolveVendorCoords({
                vendorId: o.vendorId,
                neighbourhood: o.neighbourhood,
              });
        if (!resolved) return null;
        const address =
          o.address ||
          resolveVendorAddress({
            vendorId: o.vendorId,
            neighbourhood: o.neighbourhood,
          }) ||
          undefined;
        return { ...o, ...resolved, address };
      })
      .filter(Boolean) as Array<
      PreviewOfferPin & { lng: number; lat: number; address?: string }
    >;
  }, [offers]);

  const focus = useMemo(() => {
    if (!selectedOfferId) return null;
    return pins.find((p) => p.id === selectedOfferId) || null;
  }, [pins, selectedOfferId]);

  useEffect(() => {
    setImgFailed(false);
    setUseGl(true);
  }, [focus?.id, focus?.lng, focus?.lat]);

  const staticUrl = useMemo(() => {
    if (!focus) return null;
    return buildStaticMapUrl({
      lng: focus.lng,
      lat: focus.lat,
      zoom: 16,
      width: 960,
      height: 540,
      marker: true,
      highDpi: true,
    });
  }, [focus]);

  const markers: MapMarker[] = useMemo(() => {
    if (!focus) return [];
    return [
      {
        id: focus.id,
        lng: focus.lng,
        lat: focus.lat,
        label: focus.vendorName,
        kind: "pickup",
        active: true,
      },
    ];
  }, [focus]);

  const founding = focus ? vendorById(focus.vendorId) : null;
  const mapsDirections = focus
    ? `https://www.google.com/maps/dir/?api=1&destination=${focus.lat},${focus.lng}`
    : null;

  if (!selectedOfferId || !focus) {
    return (
      <section className={className}>
        <p className="text-[14px] text-black/45">
          Select a vendor above to see their exact pickup location.
        </p>
      </section>
    );
  }

  if (!hasToken) {
    return (
      <section className={className}>
        <p className="text-[14px] text-black/45">
          Map unavailable — missing Mapbox token.
        </p>
      </section>
    );
  }

  const mapHeight =
    variant === "tab" ? "h-[340px] sm:h-[400px] lg:h-[440px]" : "h-[220px]";
  const vendorHref = `/vendors/${resolveVendorSlug({
    id: focus.vendorId,
    name: focus.vendorName,
  })}`;

  return (
    <section className={className}>
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-7">
          <div className="mb-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-black/35">
              Pickup location
            </p>
            <p className="mt-2 text-[clamp(1.25rem,2.2vw,1.65rem)] font-medium tracking-tight">
              {focus.vendorName}
            </p>
            <p className="mt-1 text-[14px] text-black/45">
              {[focus.address, focus.neighbourhood, "Nairobi"]
                .filter(Boolean)
                .filter((v, i, a) => a.indexOf(v) === i)
                .join(" · ")}
            </p>
          </div>

          <div className="relative overflow-hidden border border-black/[0.08] bg-[#ebebe8]">
            <div className={`${mapHeight} w-full`}>
              {useGl ? (
                <MapCanvas
                  key={`flat-${focus.id}-${focus.lng}-${focus.lat}`}
                  className="h-full w-full"
                  mapStyle={MAPBOX_FLAT_STYLE}
                  center={[focus.lng, focus.lat]}
                  zoom={MAP_FLAT_ZOOM}
                  pitch={0}
                  bearing={0}
                  flat
                  markers={markers}
                  interactive
                  alwaysShowLabels
                  followUser={false}
                  showNavControls
                  minimalControls
                />
              ) : staticUrl && !imgFailed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={staticUrl}
                  alt={`Map of ${focus.vendorName}`}
                  width={960}
                  height={540}
                  className="h-full w-full object-cover"
                  onError={() => setImgFailed(true)}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                  <MapPin className="h-5 w-5 text-black/30" strokeWidth={1.5} />
                  <p className="text-[13px] text-black/45">Map preview unavailable.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setUseGl(true);
                      setImgFailed(false);
                    }}
                    className="text-[12px] uppercase tracking-[0.14em] underline underline-offset-4"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          </div>

          {mapsDirections ? (
            <a
              href={mapsDirections}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-[14px] font-medium underline underline-offset-[6px] decoration-black/25 hover:decoration-black"
            >
              <Navigation className="h-3.5 w-3.5" strokeWidth={1.75} />
              Get directions
            </a>
          ) : null}
        </div>

        <div className="lg:col-span-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-black/35">
            Collect here
          </p>

          <dl className="mt-5">
            {[
              { label: "Shop", value: focus.vendorName },
              focus.neighbourhood
                ? { label: "Area", value: focus.neighbourhood }
                : null,
              focus.address ? { label: "Address", value: focus.address } : null,
              {
                label: "Coordinates",
                value: `${focus.lat.toFixed(5)}, ${focus.lng.toFixed(5)}`,
              },
              founding?.specialty
                ? { label: "Specialty", value: founding.specialty }
                : null,
              { label: "Fulfilment", value: "Click & collect" },
            ]
              .filter(Boolean)
              .map((row) => (
                <div
                  key={row!.label}
                  className="flex items-start justify-between gap-6 border-b border-black/[0.06] py-4"
                >
                  <dt className="shrink-0 text-[13px] text-black/35">
                    {row!.label}
                  </dt>
                  <dd className="text-right text-[14px] font-medium leading-snug tracking-tight text-black/80">
                    {row!.value}
                  </dd>
                </div>
              ))}
          </dl>

          <Link
            href={vendorHref}
            className="mt-10 inline-flex text-[14px] font-medium underline underline-offset-[6px] decoration-black/25 hover:decoration-black"
          >
            View store page →
          </Link>
        </div>
      </div>
    </section>
  );
}
