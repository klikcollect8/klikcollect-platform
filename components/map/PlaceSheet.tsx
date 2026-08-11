"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Bike,
  Car,
  Clock,
  Copy,
  Crosshair,
  ExternalLink,
  Eye,
  Footprints,
  ListOrdered,
  MapPin,
  MapPinPlus,
  Navigation2,
  Share2,
  Star,
  Store,
  Trash2,
  X,
} from "lucide-react";
import { formatDistanceKm, formatDuration } from "@/lib/mapbox";
import { featureTypeLabel, type TravelProfile } from "@/lib/mapbox-search";
import { cn } from "@/lib/utils";

/** Clear glass for floating map popups */
const sheetGlass =
  "border border-white/25 bg-white/25 shadow-none backdrop-blur-xl";

const TRAVEL_MODES = [
  { id: "driving-traffic" as const, label: "Drive", Icon: Car },
  { id: "walking" as const, label: "Walk", Icon: Footprints },
  { id: "cycling" as const, label: "Cycle", Icon: Bike },
];

export type PlaceSheetPlace = {
  id: string;
  lng: number;
  lat: number;
  name: string;
  address: string;
  featureType?: string;
  slug?: string;
  openNow?: boolean;
  pickupMinutes?: number;
  deliveryMinutes?: number;
  rating?: number;
  reviewCount?: number;
  hoursLabel?: string;
  primaryCategory?: string;
  phone?: string;
  isVendor?: boolean;
};

type ModeEta = { durationS: number; distanceM: number } | null;

type PlaceSheetProps = {
  place: PlaceSheetPlace;
  distanceKm?: number | null;
  congestion?: string | null;
  streetViewSrc?: string | null;
  tripCount?: number;
  whatsHere?: Array<{ id: string; name: string; featureType: string }>;
  /** portal = floating card; embedded = inline (bottom sheet) */
  variant?: "portal" | "embedded";
  onClose: () => void;
  onStreetView: () => void;
  onOpenMaps: () => void;
  onCopy: () => void;
  onShare: () => void;
  onPickRelated?: (id: string) => void;
  onFlyHere?: () => void;
  /** Start Mapbox in-map directions */
  onDirections?: () => void;
};

/** Transparent place details — top right */
export default function PlaceSheet({
  place,
  distanceKm: dist,
  congestion,
  streetViewSrc,
  tripCount = 0,
  whatsHere = [],
  variant = "portal",
  onClose,
  onStreetView,
  onOpenMaps,
  onCopy,
  onShare,
  onPickRelated,
  onFlyHere,
  onDirections,
}: PlaceSheetProps) {
  const [mounted, setMounted] = useState(false);
  const [showStreetView, setShowStreetView] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setShowStreetView(false);
  }, [place.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted && variant === "portal") return null;

  const eyebrow = place.isVendor
    ? place.primaryCategory || "KlikCollect shop"
    : featureTypeLabel(place.featureType || "place");
  const coords = `${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}`;

  const body = (
    <>
      <div className="flex items-start justify-between gap-3 px-4 pb-1 pt-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-black/40">
          {eyebrow}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="text-black/35 hover:text-black"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3.5 px-4 pb-4 pt-2">
        <div>
          <h2 className="text-[18px] font-medium tracking-tight text-black">
            {place.name}
          </h2>
          <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-relaxed text-black/50">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-black/30" />
            <span>{place.address}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-black/45">
          {place.isVendor ? (
            <>
              <span className={place.openNow ? "text-[#248a3d]" : undefined}>
                {place.openNow ? "Open now" : "Closed"}
              </span>
              {place.hoursLabel ? <span>{place.hoursLabel}</span> : null}
              {place.pickupMinutes != null ? (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {place.pickupMinutes} min pickup
                </span>
              ) : null}
              {place.rating != null && place.rating > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3 w-3 fill-current" />
                  {place.rating.toFixed(1)}
                  {place.reviewCount ? ` · ${place.reviewCount}` : ""}
                </span>
              ) : null}
            </>
          ) : null}
          {dist != null ? <span>{formatDistanceKm(dist)} away</span> : null}
          {congestion ? <span>Route · {congestion}</span> : null}
          {tripCount > 0 ? (
            <span>
              {tripCount} stop{tripCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>

        {place.isVendor && place.slug ? (
          <Link
            href={`/vendors/${place.slug}`}
            className="inline-flex h-11 w-full items-center justify-center gap-2 bg-black/90 text-[12px] font-medium uppercase tracking-[0.12em] text-white hover:bg-black"
          >
            <Store className="h-4 w-4" />
            Visit shop
          </Link>
        ) : null}

        {onDirections ? (
          <button
            type="button"
            onClick={onDirections}
            className="inline-flex h-11 w-full items-center justify-center gap-2 bg-black/90 text-[12px] font-medium uppercase tracking-[0.12em] text-white hover:bg-black"
          >
            <Navigation2 className="h-4 w-4" />
            Directions
          </button>
        ) : null}

        {showStreetView && streetViewSrc ? (
          <div className="overflow-hidden bg-black/[0.04]">
            <div className="relative aspect-[16/10] w-full">
              <iframe
                title={`Street View · ${place.name}`}
                src={streetViewSrc}
                className="absolute inset-0 h-full w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          </div>
        ) : null}

        {whatsHere.length > 1 ? (
          <div className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-black/35">
              What&apos;s here
            </p>
            <div className="scrollbar-hide max-h-28 overflow-y-auto">
              {whatsHere.slice(0, 6).map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => onPickRelated?.(w.id)}
                  className="flex w-full items-center justify-between gap-2 py-2 text-left"
                >
                  <span className="min-w-0 truncate text-[12px] text-black/70">
                    {w.name}
                  </span>
                  <span className="shrink-0 text-[9px] uppercase tracking-[0.1em] text-black/30">
                    {featureTypeLabel(w.featureType)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-1.5 border-t border-black/[0.06] pt-3">
          <IconBtn
            title="Street View"
            onClick={() => {
              if (streetViewSrc) setShowStreetView((v) => !v);
              else onStreetView();
            }}
          >
            <Eye className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn title="Open in Google Maps" onClick={onOpenMaps}>
            <ExternalLink className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn title="Copy location" onClick={onCopy}>
            <Copy className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn title="Share" onClick={onShare}>
            <Share2 className="h-3.5 w-3.5" />
          </IconBtn>
          {onFlyHere ? (
            <IconBtn title="Center map" onClick={onFlyHere}>
              <Crosshair className="h-3.5 w-3.5" />
            </IconBtn>
          ) : null}
        </div>

        <p className="text-[10px] tabular-nums text-black/35">{coords}</p>
      </div>
    </>
  );

  if (variant === "embedded") {
    return (
      <div role="dialog" aria-label={place.name} className="w-full">
        {body}
      </div>
    );
  }

  return createPortal(
    <div
      role="dialog"
      aria-label={place.name}
      className={cn(
        "pointer-events-auto fixed right-3 top-[5.5rem] z-[80] w-[min(100%-1.5rem,20.5rem)] sm:right-5 sm:top-24 sm:w-[22rem]",
        "scrollbar-hide max-h-[min(62vh,480px)] overflow-y-auto",
        "hidden md:block",
        sheetGlass,
      )}
    >
      {body}
    </div>,
    document.body,
  );
}

function IconBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center bg-black/[0.05] text-black/50 hover:bg-black/85 hover:text-white"
    >
      {children}
    </button>
  );
}

type RoutePanelProps = {
  travel: TravelProfile;
  modeEtas: Partial<Record<TravelProfile, ModeEta>>;
  stepsOpen?: boolean;
  routeSteps?: Array<{ instruction: string }>;
  inTrip?: boolean;
  tripStops?: PlaceSheetPlace[];
  orderedIds?: string[];
  tripOpen?: boolean;
  totalMeta?: { durationS: number; distanceM: number } | null;
  optimizing?: boolean;
  hasDestination?: boolean;
  /** portal = floating; embedded = inline in bottom sheet */
  variant?: "portal" | "embedded";
  onTravelChange: (id: TravelProfile) => void;
  /** Primary: start / focus Mapbox in-map route */
  onNavigate: () => void;
  /** Secondary: open Google Maps directions */
  onOpenExternal?: () => void;
  onToggleSteps: () => void;
  onAddStop: () => void;
  onRemoveStop?: () => void;
  onOpenTrip: () => void;
  onCloseTrip?: () => void;
  onRemoveTripStop?: (id: string) => void;
  onSelectTripStop?: (id: string) => void;
  onClearTrip?: () => void;
  onOptimize?: () => void;
};

/** Bottom-left routing / multi-stop panel */
export function RoutePanel({
  travel,
  modeEtas,
  stepsOpen,
  routeSteps = [],
  inTrip,
  tripStops = [],
  orderedIds,
  tripOpen,
  totalMeta,
  optimizing,
  hasDestination,
  variant = "portal",
  onTravelChange,
  onNavigate,
  onOpenExternal,
  onToggleSteps,
  onAddStop,
  onRemoveStop,
  onOpenTrip,
  onCloseTrip,
  onRemoveTripStop,
  onSelectTripStop,
  onClearTrip,
  onOptimize,
}: RoutePanelProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted && variant === "portal") return null;

  const order =
    orderedIds && orderedIds.length === tripStops.length
      ? orderedIds
      : tripStops.map((s) => s.id);
  const byId = new Map(tripStops.map((s) => [s.id, s]));

  const panel = (
    <div
      className={cn(
        "flex w-full flex-col gap-2.5",
        variant === "portal" &&
          "pointer-events-none hidden md:flex md:w-[min(100%-6.5rem,20.5rem)]",
      )}
    >
      {tripStops.length > 0 && tripOpen ? (
        <div
          className={cn(
            "pointer-events-auto scrollbar-hide max-h-[min(34vh,280px)] overflow-y-auto",
            sheetGlass,
          )}
        >
          <div className="space-y-3 px-3.5 py-3.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-black/35">
                Your stops · {tripStops.length}
                {totalMeta ? ` · ${formatDuration(totalMeta.durationS)}` : ""}
              </p>
              <button
                type="button"
                onClick={onCloseTrip}
                className="text-black/30 hover:text-black"
                aria-label="Hide stops"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <ol className="scrollbar-hide max-h-36 overflow-y-auto">
              {order.map((id, i) => {
                const s = byId.get(id);
                if (!s) return null;
                return (
                  <li
                    key={id}
                    className="flex items-center gap-2 border-t border-black/[0.05] py-2 first:border-0"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center bg-black text-[10px] text-white">
                      {i + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectTripStop?.(id)}
                      className="min-w-0 flex-1 truncate text-left text-[12px] font-medium text-black"
                    >
                      {s.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveTripStop?.(id)}
                      className="text-black/30 hover:text-black"
                      aria-label={`Remove ${s.name}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </li>
                );
              })}
            </ol>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={onOptimize}
                disabled={tripStops.length < 2 || optimizing}
                className="inline-flex h-9 flex-1 items-center justify-center bg-black/85 text-[10px] font-medium uppercase tracking-[0.12em] text-white disabled:opacity-40"
              >
                {optimizing ? "…" : "Best route"}
              </button>
              <button
                type="button"
                onClick={onClearTrip}
                className="inline-flex h-9 px-3 text-[10px] font-medium uppercase tracking-[0.12em] text-black/40 hover:text-black"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "pointer-events-auto scrollbar-hide max-h-[min(46vh,380px)] overflow-y-auto",
          variant === "embedded" ? "" : sheetGlass,
        )}
      >
        <div className="space-y-3 px-3.5 py-3.5">
          <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-1.5">
            <button
              type="button"
              disabled={!hasDestination && tripStops.length === 0}
              onClick={onNavigate}
              className="inline-flex h-11 items-center justify-center gap-1.5 bg-black/90 text-[10px] font-medium uppercase tracking-[0.1em] text-white hover:bg-black disabled:opacity-40"
            >
              <Navigation2 className="h-3.5 w-3.5" />
              Directions
            </button>
            <button
              type="button"
              disabled={!hasDestination}
              onClick={inTrip ? onRemoveStop : onAddStop}
              className={cn(
                "inline-flex h-11 items-center justify-center gap-1 text-[10px] font-medium uppercase tracking-[0.1em] disabled:opacity-40",
                inTrip
                  ? "bg-black/85 text-white"
                  : "bg-black/[0.05] text-black/60 hover:bg-black/85 hover:text-white",
              )}
            >
              {inTrip ? (
                <Trash2 className="h-3.5 w-3.5" />
              ) : (
                <MapPinPlus className="h-3.5 w-3.5" />
              )}
              {inTrip ? "Remove" : "Add stop"}
            </button>
            <button
              type="button"
              onClick={onToggleSteps}
              className={cn(
                "inline-flex h-11 items-center justify-center gap-1 text-[10px] font-medium uppercase tracking-[0.1em]",
                stepsOpen
                  ? "bg-black/85 text-white"
                  : "bg-black/[0.05] text-black/60 hover:bg-black/85 hover:text-white",
              )}
            >
              <ListOrdered className="h-3.5 w-3.5" />
              Steps
            </button>
          </div>

          {onOpenExternal ? (
            <button
              type="button"
              onClick={onOpenExternal}
              className="inline-flex w-full items-center justify-center gap-1.5 text-[11px] text-black/45 hover:text-black"
            >
              <ExternalLink className="h-3 w-3" />
              Open in Google Maps
            </button>
          ) : null}

          {tripStops.length > 0 ? (
            <button
              type="button"
              onClick={tripOpen ? onCloseTrip : onOpenTrip}
              className="w-full text-left text-[11px] text-black/50 hover:text-black"
            >
              {tripOpen
                ? "Hide stop list"
                : `View ${tripStops.length} stop${tripStops.length === 1 ? "" : "s"}`}
            </button>
          ) : null}

          <div>
            <p className="mb-2 text-[9px] font-medium uppercase tracking-[0.14em] text-black/35">
              How to get there
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {TRAVEL_MODES.map(({ id, label, Icon }) => {
                const eta = modeEtas[id];
                const active = travel === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onTravelChange(id)}
                    className={cn(
                      "flex flex-col items-center gap-1 px-1.5 py-2.5 transition-colors",
                      active
                        ? "bg-black/85 text-white"
                        : "bg-black/[0.04] text-black/50 hover:bg-black/[0.07] hover:text-black",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                    <span className="text-[9px] font-medium uppercase tracking-[0.1em]">
                      {label}
                    </span>
                    <span className="text-[12px] font-medium tabular-nums">
                      {eta ? formatDuration(eta.durationS) : "—"}
                    </span>
                    <span
                      className={cn(
                        "text-[9px] tabular-nums",
                        active ? "text-white/50" : "text-black/30",
                      )}
                    >
                      {eta ? formatDistanceKm(eta.distanceM / 1000) : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {stepsOpen && routeSteps.length > 0 ? (
            <div>
              <p className="mb-1.5 text-[9px] font-medium uppercase tracking-[0.14em] text-black/35">
                Turn-by-turn
              </p>
              <ol className="scrollbar-hide max-h-36 overflow-y-auto">
                {routeSteps.slice(0, 16).map((step, i) => (
                  <li
                    key={`${i}-${step.instruction}`}
                    className="flex gap-2 border-t border-black/[0.05] py-2 text-[11px] first:border-0"
                  >
                    <span className="w-4 shrink-0 tabular-nums text-black/30">
                      {i + 1}
                    </span>
                    <span className="min-w-0 text-black/65">
                      {step.instruction}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  if (variant === "embedded") return panel;

  return createPortal(
    <div className="pointer-events-none fixed bottom-4 left-3 z-[80] sm:bottom-6 sm:left-5">
      {panel}
    </div>,
    document.body,
  );
}

/** @deprecated use RoutePanel — kept for import compatibility */
export function TripSheet(props: {
  stops: PlaceSheetPlace[];
  orderedIds?: string[];
  travel: TravelProfile;
  modeEtas: Partial<Record<TravelProfile, ModeEta>>;
  totalMeta?: { durationS: number; distanceM: number } | null;
  optimizing?: boolean;
  onClose: () => void;
  onTravelChange: (id: TravelProfile) => void;
  onRemove: (id: string) => void;
  onSelect: (id: string) => void;
  onClear: () => void;
  onOptimize: () => void;
}) {
  return (
    <RoutePanel
      travel={props.travel}
      modeEtas={props.modeEtas}
      tripStops={props.stops}
      orderedIds={props.orderedIds}
      tripOpen
      totalMeta={props.totalMeta}
      optimizing={props.optimizing}
      hasDestination={props.stops.length > 0}
      onTravelChange={props.onTravelChange}
      onNavigate={() => {}}
      onToggleSteps={() => {}}
      onAddStop={() => {}}
      onOpenTrip={() => {}}
      onCloseTrip={props.onClose}
      onRemoveTripStop={props.onRemove}
      onSelectTripStop={props.onSelect}
      onClearTrip={props.onClear}
      onOptimize={props.onOptimize}
    />
  );
}
