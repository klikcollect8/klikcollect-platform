"use client";

import { useState } from "react";
import {
  Aperture,
  Box,
  Layers,
  List,
  LocateFixed,
  Maximize2,
  Minus,
  Move,
  Navigation2,
  Plus,
  Route,
  Satellite,
  Scan,
  SlidersHorizontal,
  View,
  Map as MapIcon,
} from "lucide-react";
import {
  getMapPovPresets,
  getMapStylePresets,
  type MapPovId,
  type MapStyleId,
} from "@/lib/mapbox";
import { cn } from "@/lib/utils";

/** Shared translucent map surface — blends into the basemap */
export const mapGlass =
  "border border-white/35 bg-white/45 shadow-none backdrop-blur-2xl";

type MapChromeProps = {
  className?: string;
  styleId?: MapStyleId;
  onStyleChange?: (id: MapStyleId) => void;
  povId?: MapPovId;
  onPovChange?: (id: MapPovId) => void;
  onRecenter?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFullscreen?: () => void;
  onListToggle?: () => void;
  listOpen?: boolean;
  /** Layers / filters panel (traffic, isochrone, shop filters) */
  onLayersToggle?: () => void;
  layersOpen?: boolean;
  showStyleToggle?: boolean;
  showPovToggle?: boolean;
  /** Start with map-type / POV panels collapsed */
  collapsible?: boolean;
  compact?: boolean;
};

const STYLE_ICONS: Record<MapStyleId, typeof MapIcon> = {
  street: MapIcon,
  perfect: Route,
  satellite: Satellite,
  "map-3d": Box,
};

const POV_ICONS: Record<MapPovId, typeof MapIcon> = {
  top: Scan,
  street: View,
  bird: Aperture,
  cinema: Box,
  heading: Navigation2,
  free: Move,
};

function IconBtn({
  active,
  title,
  onClick,
  children,
  className,
}: {
  active?: boolean;
  title: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center transition-colors",
        active
          ? "bg-black/90 text-white"
          : "text-black/55 hover:bg-white/45 hover:text-black",
        className,
      )}
    >
      {children}
    </button>
  );
}

export default function MapChrome({
  className,
  styleId = "street",
  onStyleChange,
  povId = "top",
  onPovChange,
  onRecenter,
  onZoomIn,
  onZoomOut,
  onFullscreen,
  onListToggle,
  listOpen = false,
  onLayersToggle,
  layersOpen = false,
  showStyleToggle = true,
  showPovToggle = true,
  collapsible = true,
}: MapChromeProps) {
  const [stylesOpen, setStylesOpen] = useState(!collapsible);
  const [povOpen, setPovOpen] = useState(!collapsible);

  return (
    <div
      className={cn(
        "pointer-events-none flex flex-col items-end gap-1.5",
        className,
      )}
    >
      {showStyleToggle && onStyleChange ? (
        <div className="pointer-events-auto flex flex-col items-end gap-1">
          {stylesOpen ? (
            <div
              className={cn("grid grid-cols-2 overflow-hidden", mapGlass)}
              role="group"
              aria-label="Map style"
            >
              {getMapStylePresets().map((p) => {
                const Icon = STYLE_ICONS[p.id];
                return (
                  <IconBtn
                    key={p.id}
                    title={p.name}
                    active={styleId === p.id}
                    onClick={() => onStyleChange(p.id)}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  </IconBtn>
                );
              })}
            </div>
          ) : null}
          <div className={cn("overflow-hidden", mapGlass)}>
            <IconBtn
              title="Map type"
              active={stylesOpen}
              onClick={() => {
                setStylesOpen((v) => !v);
                if (!stylesOpen) setPovOpen(false);
              }}
            >
              <Layers className="h-4 w-4" strokeWidth={1.75} />
            </IconBtn>
          </div>
        </div>
      ) : null}

      {showPovToggle && onPovChange ? (
        <div className="pointer-events-auto flex flex-col items-end gap-1">
          {povOpen ? (
            <div
              className={cn("grid grid-cols-3 overflow-hidden", mapGlass)}
              role="group"
              aria-label="Point of view"
            >
              {getMapPovPresets().map((p) => {
                const Icon = POV_ICONS[p.id];
                return (
                  <IconBtn
                    key={p.id}
                    title={p.name}
                    active={povId === p.id}
                    onClick={() => onPovChange(p.id)}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  </IconBtn>
                );
              })}
            </div>
          ) : null}
          <div className={cn("overflow-hidden", mapGlass)}>
            <IconBtn
              title="Point of view"
              active={povOpen}
              onClick={() => {
                setPovOpen((v) => !v);
                if (!povOpen) setStylesOpen(false);
              }}
            >
              <View className="h-4 w-4" strokeWidth={1.75} />
            </IconBtn>
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "pointer-events-auto flex flex-col overflow-hidden",
          mapGlass,
        )}
      >
        {onZoomIn ? (
          <IconBtn title="Zoom in" onClick={onZoomIn}>
            <Plus className="h-4 w-4" />
          </IconBtn>
        ) : null}
        {onZoomOut ? (
          <IconBtn
            title="Zoom out"
            onClick={onZoomOut}
            className="border-t border-black/[0.06]"
          >
            <Minus className="h-4 w-4" />
          </IconBtn>
        ) : null}
        {onRecenter ? (
          <IconBtn
            title="Recenter"
            onClick={onRecenter}
            className="border-t border-black/[0.06]"
          >
            <LocateFixed className="h-4 w-4" />
          </IconBtn>
        ) : null}
        {onListToggle ? (
          <IconBtn
            title="Shop list"
            active={listOpen}
            onClick={onListToggle}
            className="border-t border-black/[0.06]"
          >
            <List className="h-4 w-4" />
          </IconBtn>
        ) : null}
        {onLayersToggle ? (
          <IconBtn
            title="Layers"
            active={layersOpen}
            onClick={onLayersToggle}
            className="border-t border-black/[0.06]"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </IconBtn>
        ) : null}
        {onFullscreen ? (
          <IconBtn
            title="Fullscreen"
            onClick={onFullscreen}
            className="border-t border-black/[0.06]"
          >
            <Maximize2 className="h-4 w-4" />
          </IconBtn>
        ) : null}
      </div>
    </div>
  );
}
