"use client";

/**
 * Customer Location Page — /account/addresses
 *
 * Full location management: active "Deliver to" selection, saved locations
 * (DB-backed via /api/user/locations, localStorage fallback), and recent
 * destinations with clear-history. Add/edit flows open the shared
 * LocationPicker (search → pin verify → details).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { MapPin, Navigation, Plus, Star } from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useUserLocation } from "@/components/providers/LocationProvider";
import { useActiveLocation } from "@/components/providers/ActiveLocationProvider";
import {
  deleteSavedLocation,
  listSavedLocations,
  touchSavedLocation,
  upsertSavedLocation,
  type SavedLocation,
} from "@/lib/location/saved-locations";
import {
  clearRecentDestinations,
  listRecentDestinations,
  type RecentDestination,
} from "@/lib/nav/recent-destinations";
import type { LocationPickerResult } from "@/components/location/LocationPicker";
import LocationConfidenceBadge from "@/components/location/LocationConfidenceBadge";
import { buildStaticMapUrl, getMapboxToken } from "@/lib/mapbox";

const LocationPicker = dynamic(
  () => import("@/components/location/LocationPicker"),
  { ssr: false },
);

const sectionLabel =
  "text-[11px] font-medium uppercase tracking-[0.18em] text-black/35";
const actionLink =
  "text-[12px] text-black/50 underline underline-offset-[4px] decoration-black/15 transition-colors hover:text-black";

function shortLabel(full: string | null | undefined): string {
  if (!full) return "Saved location";
  return (
    full
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .slice(0, 2)
      .join(", ") || full
  );
}

export default function AccountLocationsPage() {
  const { showToast } = useToast();
  const mounted = useIsClient();
  const { active, setActive } = useActiveLocation();
  const { coords, status: gpsStatus } = useUserLocation();

  const [locations, setLocations] = useState<SavedLocation[]>([]);
  const [remote, setRemote] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recents, setRecents] = useState<RecentDestination[]>([]);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [editing, setEditing] = useState<SavedLocation | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const hasToken = Boolean(getMapboxToken());

  const refresh = useCallback(async () => {
    const { locations: list, remote: isRemote } = await listSavedLocations();
    setLocations(list);
    setRemote(isRemote);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    setRecents(listRecentDestinations());
  }, [refresh]);

  const sorted = useMemo(
    () =>
      [...locations].sort((a, b) => {
        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
        return (
          (b.lastUsedAt || b.createdAt) - (a.lastUsedAt || a.createdAt)
        );
      }),
    [locations],
  );

  /* ------------------------------- actions ------------------------------- */

  const useLocation = (loc: SavedLocation) => {
    void touchSavedLocation(loc.id);
    setActive({
      lat: loc.lat,
      lng: loc.lng,
      label: shortLabel(loc.formattedAddress || loc.name),
      formattedAddress: loc.formattedAddress,
      building: loc.building,
      landmark: loc.landmark,
      instructions: loc.instructions,
      placeId: loc.placeId ?? null,
      source: loc.source,
      confidence: loc.confidence,
      savedLocationId: loc.id,
      setAt: Date.now(),
    });
    showToast(`Delivering to ${loc.name}`, "success");
  };

  const useRecent = (dest: RecentDestination) => {
    setActive({
      lat: dest.lat,
      lng: dest.lng,
      label: shortLabel(dest.label),
      formattedAddress: dest.label,
      source: "manual",
      confidence: "medium",
      setAt: Date.now(),
    });
    showToast(`Delivering to ${shortLabel(dest.label)}`, "success");
  };

  const remove = async (loc: SavedLocation) => {
    await deleteSavedLocation(loc.id);
    setLocations((prev) => prev.filter((l) => l.id !== loc.id));
    showToast("Location removed", "success");
  };

  const setDefault = async (loc: SavedLocation) => {
    try {
      await upsertSavedLocation({ ...loc, isDefault: true });
      await refresh();
      showToast(`${loc.name} is your default location`, "success");
    } catch {
      showToast("Could not update location", "error");
    }
  };

  const saveRename = async (loc: SavedLocation) => {
    const name = renameValue.trim();
    setRenamingId(null);
    if (!name || name === loc.name) return;
    try {
      await upsertSavedLocation({ ...loc, name });
      await refresh();
      showToast("Location renamed", "success");
    } catch {
      showToast("Could not rename location", "error");
    }
  };

  const handlePickerConfirm = async (r: LocationPickerResult) => {
    const wasEditing = editing;
    setPickerOpen(false);
    setEditing(null);

    // The picker saves itself when the user ticks "save as" — only upsert
    // here when editing an existing record that the picker didn't persist.
    if (wasEditing && !r.savedName) {
      try {
        await upsertSavedLocation({
          ...wasEditing,
          lat: r.lat,
          lng: r.lng,
          addressLat: r.addressLat ?? wasEditing.addressLat,
          addressLng: r.addressLng ?? wasEditing.addressLng,
          formattedAddress: r.formattedAddress || wasEditing.formattedAddress,
          building: r.building ?? wasEditing.building,
          floor: r.floor ?? wasEditing.floor,
          unit: r.unit ?? wasEditing.unit,
          estate: r.estate ?? wasEditing.estate,
          landmark: r.landmark ?? wasEditing.landmark,
          instructions: r.instructions ?? wasEditing.instructions,
          placeId: r.placeId ?? wasEditing.placeId,
          source: r.source,
          confidence: r.confidence,
          verification:
            r.source === "gps"
              ? "gps_verified"
              : r.confidence === "user_pinned"
                ? "user_pinned"
                : wasEditing.verification,
        });
        showToast("Location updated", "success");
      } catch {
        showToast("Could not update location", "error");
      }
    } else if (!wasEditing && !r.savedName) {
      // Added from the picker without ticking save — persist it anyway so
      // "Add location" always results in a saved entry.
      try {
        await upsertSavedLocation({
          name: shortLabel(r.formattedAddress),
          label: "other",
          lat: r.lat,
          lng: r.lng,
          addressLat: r.addressLat ?? null,
          addressLng: r.addressLng ?? null,
          formattedAddress: r.formattedAddress,
          building: r.building,
          floor: r.floor,
          unit: r.unit,
          estate: r.estate,
          landmark: r.landmark,
          instructions: r.instructions,
          placeId: r.placeId ?? null,
          source: r.source,
          confidence: r.confidence,
          verification:
            r.source === "gps"
              ? "gps_verified"
              : r.confidence === "user_pinned"
                ? "user_pinned"
                : "unverified",
        });
        showToast("Location saved", "success");
      } catch {
        showToast("Could not save location", "error");
      }
    }
    await refresh();
  };

  /* -------------------------------- render ------------------------------- */

  if (!mounted) {
    return <p className="text-[14px] text-black/35">Loading…</p>;
  }

  return (
    <div className="space-y-12 text-left">
      <div>
        <p className={sectionLabel}>Locations</p>
        <p className="mt-2 text-[14px] leading-relaxed text-black/45">
          Manage where we deliver.{" "}
          {remote
            ? "Saved locations sync across your devices."
            : "Saved locations are stored on this device — sign in to sync."}
        </p>
      </div>

      {/* ---------------------------- Current ---------------------------- */}
      <section>
        <div className="flex items-center justify-between">
          <p className={sectionLabel}>Deliver to</p>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setPickerOpen(true);
            }}
            className={actionLink}
          >
            Change
          </button>
        </div>
        <div className="mt-3 border border-black/10 bg-white/60 px-4 py-4">
          {active ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[15px] font-medium">{active.label}</p>
                <LocationConfidenceBadge confidence={active.confidence} />
              </div>
              {active.formattedAddress &&
              active.formattedAddress !== active.label ? (
                <p className="mt-1 text-[13px] text-black/45">
                  {active.formattedAddress}
                </p>
              ) : null}
              {active.landmark ? (
                <p className="mt-1 text-[13px] text-black/40">
                  Near {active.landmark}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-[14px] text-black/40">
              No delivery location chosen yet.
            </p>
          )}
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-black/35">
            <Navigation className="h-3 w-3" strokeWidth={1.75} />
            {gpsStatus === "ready" && coords
              ? `GPS active ±${Math.round(coords.accuracy ?? 0)} m`
              : gpsStatus === "denied"
                ? "GPS off — location permission denied"
                : gpsStatus === "locating"
                  ? "Locating…"
                  : "GPS idle"}
          </p>
        </div>
      </section>

      {/* ----------------------------- Saved ----------------------------- */}
      <section>
        <div className="flex items-center justify-between">
          <p className={sectionLabel}>Saved locations</p>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setPickerOpen(true);
            }}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-black underline underline-offset-[4px] decoration-black/25 hover:opacity-70"
          >
            <Plus className="h-3 w-3" strokeWidth={2} />
            Add location
          </button>
        </div>

        {loading ? (
          <p className="mt-4 text-[13px] text-black/35">Loading…</p>
        ) : sorted.length === 0 ? (
          <div className="mt-4 border border-dashed border-black/15 px-4 py-8 text-center">
            <MapPin
              className="mx-auto h-5 w-5 text-black/30"
              strokeWidth={1.5}
            />
            <p className="mt-2 text-[13px] text-black/40">
              No saved locations yet. Add home, work, or anywhere you order
              often.
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-4">
            {sorted.map((loc) => {
              const staticUrl = hasToken
                ? buildStaticMapUrl({
                    lng: loc.lng,
                    lat: loc.lat,
                    zoom: 15,
                    width: 400,
                    height: 140,
                  })
                : null;
              const isActive = active?.savedLocationId === loc.id;
              return (
                <li
                  key={loc.id}
                  className="overflow-hidden border border-black/10 bg-white/60"
                >
                  {staticUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={staticUrl}
                      alt={`Map of ${loc.name}`}
                      width={400}
                      height={140}
                      loading="lazy"
                      className="h-[120px] w-full object-cover"
                    />
                  ) : null}
                  <div className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {renamingId === loc.id ? (
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => void saveRename(loc)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void saveRename(loc);
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          className="border-b border-black/25 bg-transparent text-[15px] font-medium outline-none"
                          aria-label="Location name"
                        />
                      ) : (
                        <p className="text-[15px] font-medium">{loc.name}</p>
                      )}
                      {loc.isDefault ? (
                        <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.1em] text-black/40">
                          <Star className="h-3 w-3" strokeWidth={1.75} />
                          Default
                        </span>
                      ) : null}
                      {isActive ? (
                        <span className="text-[11px] uppercase tracking-[0.1em] text-emerald-800/70">
                          Active
                        </span>
                      ) : null}
                      <LocationConfidenceBadge confidence={loc.confidence} />
                    </div>
                    <p className="mt-1 text-[13px] leading-snug text-black/45">
                      {loc.formattedAddress ||
                        `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`}
                    </p>
                    {loc.landmark ? (
                      <p className="mt-0.5 text-[12px] text-black/35">
                        Near {loc.landmark}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-4">
                      <button
                        type="button"
                        onClick={() => useLocation(loc)}
                        className="text-[12px] font-medium text-black underline underline-offset-[4px] decoration-black/25 hover:opacity-70"
                      >
                        Use
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(loc);
                          setPickerOpen(true);
                        }}
                        className={actionLink}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingId(loc.id);
                          setRenameValue(loc.name);
                        }}
                        className={actionLink}
                      >
                        Rename
                      </button>
                      {!loc.isDefault ? (
                        <button
                          type="button"
                          onClick={() => void setDefault(loc)}
                          className={actionLink}
                        >
                          Make default
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void remove(loc)}
                        className="text-[12px] text-black/30 underline underline-offset-[4px] decoration-black/10 transition-colors hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ----------------------------- Recent ----------------------------- */}
      <section>
        <div className="flex items-center justify-between">
          <p className={sectionLabel}>Recent</p>
          {recents.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                clearRecentDestinations();
                setRecents([]);
                showToast("Recent locations cleared", "success");
              }}
              className={actionLink}
            >
              Clear history
            </button>
          ) : null}
        </div>
        {recents.length === 0 ? (
          <p className="mt-3 text-[13px] text-black/35">
            No recent destinations.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-black/[0.06] border-y border-black/[0.06]">
            {recents.map((dest) => (
              <li
                key={dest.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-[14px]">{dest.label}</p>
                  {dest.sub ? (
                    <p className="truncate text-[12px] text-black/35">
                      {dest.sub}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => useRecent(dest)}
                  className="shrink-0 text-[12px] font-medium text-black underline underline-offset-[4px] decoration-black/25 hover:opacity-70"
                >
                  Use
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <LocationPicker
        open={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
          setEditing(null);
        }}
        onConfirm={(r) => void handlePickerConfirm(r)}
        context="saved_location"
        title={editing ? `Edit ${editing.name}` : "Add a location"}
        confirmLabel={editing ? "Save changes" : "Save location"}
        initial={
          editing
            ? {
                lat: editing.lat,
                lng: editing.lng,
                formattedAddress: editing.formattedAddress,
                building: editing.building,
                floor: editing.floor,
                unit: editing.unit,
                estate: editing.estate,
                landmark: editing.landmark,
                instructions: editing.instructions,
                name: editing.name,
                savedLocationId: editing.id,
              }
            : null
        }
        showShortcuts={!editing}
      />
    </div>
  );
}
