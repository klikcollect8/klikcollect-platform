"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { useUserLocation } from "@/components/providers/LocationProvider";
import DriverMapShell from "@/components/driver/DriverMapShell";
import DriverBottomSheet from "@/components/driver/DriverBottomSheet";
import ActiveJobCard from "@/components/driver/ActiveJobCard";
import type { MapMarker } from "@/components/map/MapCanvas";
import {
  isActiveDeliveryStatus,
  nextStatusAction,
  type DriverDelivery,
} from "@/lib/driver/types";
import {
  distanceKm,
  formatDistanceKm,
  formatDuration,
  NAIROBI_CENTER,
} from "@/lib/mapbox";
import { fetchDirections, forwardGeocode } from "@/lib/mapbox-search";

const ONLINE_KEY = "klikcollect:driver-online";
const ACTIVE_KEY = "klikcollect:driver-active-delivery";

export default function DriverMapPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] items-center justify-center bg-[#e8e8e4] text-[12px] uppercase tracking-wider text-black/40">
          Loading driver map
        </div>
      }
    >
      <DriverMapInner />
    </Suspense>
  );
}

function DriverMapInner() {
  const searchParams = useSearchParams();
  const focusId = searchParams.get("focus");
  const { coords, track, status: locStatus } = useUserLocation();

  const [online, setOnline] = useState(false);
  const [onlineBusy, setOnlineBusy] = useState(false);
  const [rows, setRows] = useState<DriverDelivery[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [route, setRoute] = useState<GeoJSON.LineString | null>(null);
  const [routeMeta, setRouteMeta] = useState<{
    distanceM: number;
    durationS: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [cameraBump, setCameraBump] = useState(0);
  const geocodeTried = useRef<Set<string>>(new Set());
  const lastPing = useRef(0);

  const load = useCallback(() => {
    void fetch("/api/driver/deliveries")
      .then((r) => r.json())
      .then((j) => setRows((j.data || []) as DriverDelivery[]));
  }, []);

  useEffect(() => {
    try {
      setOnline(localStorage.getItem(ONLINE_KEY) === "1");
      setActiveId(localStorage.getItem(ACTIVE_KEY));
    } catch {
      /* ignore */
    }
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (focusId) setActiveId(focusId);
  }, [focusId]);

  useEffect(() => {
    if (online) track();
  }, [online, track]);

  const activeJobs = useMemo(
    () => rows.filter((d) => isActiveDeliveryStatus(d.status)),
    [rows],
  );

  const active = useMemo(() => {
    if (activeId) {
      const found = activeJobs.find((d) => d.id === activeId);
      if (found) return found;
    }
    return (
      activeJobs.find(
        (d) => d.status === "in_transit" || d.status === "picked_up",
      ) ||
      activeJobs[0] ||
      null
    );
  }, [activeJobs, activeId]);

  const userLngLat = useMemo((): [number, number] | null => {
    if (!coords) return null;
    return [coords.lng, coords.lat];
  }, [coords]);

  // Persist online + ping location
  const pushLocation = useCallback(
    async (nextOnline: boolean) => {
      if (!coords) return;
      const now = Date.now();
      if (now - lastPing.current < 7000 && nextOnline === online) return;
      lastPing.current = now;
      await fetch("/api/driver/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: coords.lat,
          lng: coords.lng,
          accuracy: coords.accuracy,
          online: nextOnline,
          activeDeliveryId: active?.id || null,
        }),
      });
    },
    [coords, online, active?.id],
  );

  useEffect(() => {
    if (!online || !coords) return;
    void pushLocation(true);
    const t = setInterval(() => void pushLocation(true), 8000);
    return () => clearInterval(t);
  }, [online, coords, pushLocation]);

  const setOnlineState = async (next: boolean) => {
    setOnlineBusy(true);
    setMsg(null);
    try {
      localStorage.setItem(ONLINE_KEY, next ? "1" : "0");
      setOnline(next);
      if (next) track();
      if (coords) {
        await fetch("/api/driver/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: coords.lat,
            lng: coords.lng,
            accuracy: coords.accuracy,
            online: next,
            activeDeliveryId: next ? active?.id || null : null,
          }),
        });
      } else if (!next) {
        // still mark offline if we have last known from server - skip if no coords
      }
    } finally {
      setOnlineBusy(false);
    }
  };

  // Geocode stops missing coords
  useEffect(() => {
    for (const d of activeJobs) {
      if (d.lat != null && d.lng != null) continue;
      if (!d.address_text) continue;
      if (geocodeTried.current.has(d.id)) continue;
      geocodeTried.current.add(d.id);
      void forwardGeocode(d.address_text, coords || undefined).then((hit) => {
        if (!hit) return;
        void fetch("/api/driver/deliveries", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: d.id, lat: hit.lat, lng: hit.lng }),
        }).then(() => load());
      });
    }
  }, [activeJobs, coords, load]);

  // Directions to active stop
  useEffect(() => {
    if (!active || active.lat == null || active.lng == null || !coords) {
      setRoute(null);
      setRouteMeta(null);
      return;
    }
    let cancelled = false;
    void fetchDirections(
      { lng: coords.lng, lat: coords.lat },
      { lng: active.lng, lat: active.lat },
    ).then((dir) => {
      if (cancelled || !dir) return;
      setRoute(dir.geometry);
      setRouteMeta({ distanceM: dir.distanceM, durationS: dir.durationS });
    });
    return () => {
      cancelled = true;
    };
  }, [active?.id, active?.lat, active?.lng, coords?.lat, coords?.lng]);

  const markers = useMemo((): MapMarker[] => {
    const list: MapMarker[] = [];
    if (coords) {
      list.push({
        id: "driver-self",
        lat: coords.lat,
        lng: coords.lng,
        kind: "user",
        label: "You",
      });
    }
    for (const d of activeJobs) {
      if (d.lat == null || d.lng == null) continue;
      list.push({
        id: d.id,
        lat: d.lat,
        lng: d.lng,
        label: d.customer_name || d.public_id,
        kind: "pickup",
        active: active?.id === d.id,
      });
    }
    return list;
  }, [activeJobs, active?.id, coords]);

  const patchStatus = async (
    id: string,
    status: string,
    extra?: Record<string, unknown>,
  ) => {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/driver/deliveries", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, ...extra }),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(j.error?.message || "Update failed");
      return false;
    }
    if (status === "delivered") {
      localStorage.removeItem(ACTIVE_KEY);
      setActiveId(null);
      setOtp("");
      setNote("");
      setPhoto(null);
      setSignature(null);
      setMsg("Delivered");
    } else {
      localStorage.setItem(ACTIVE_KEY, id);
      setActiveId(id);
    }
    load();
    return true;
  };

  const onPrimary = async () => {
    if (!active) return;
    if (active.status === "in_transit") {
      await patchStatus(active.id, "delivered", {
        otp,
        pod: {
          note: note || "Delivered via driver app",
          photoDataUrl: photo,
          signatureDataUrl: signature,
          at: new Date().toISOString(),
        },
      });
      return;
    }
    const action = nextStatusAction(active.status);
    if (!action) return;
    if (action.status === "delivered") {
      await patchStatus(active.id, "delivered", {
        otp,
        pod: {
          note: note || "Delivered via driver app",
          photoDataUrl: photo,
          signatureDataUrl: signature,
          at: new Date().toISOString(),
        },
      });
      return;
    }
    await patchStatus(active.id, action.status);
  };

  const acceptJob = async (id: string) => {
    localStorage.setItem(ACTIVE_KEY, id);
    setActiveId(id);
    await patchStatus(id, "in_transit");
  };

  const openExternalNav = () => {
    if (!active || active.lat == null || active.lng == null) return;
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${active.lat},${active.lng}`,
      "_blank",
    );
  };

  // When we have assigned jobs but no "started" active, show offer for first
  const offerJob =
    online &&
    activeJobs.find((d) => d.status === "assigned") &&
    !activeJobs.some(
      (d) => d.status === "in_transit" || d.status === "picked_up",
    )
      ? activeJobs.find((d) => d.status === "assigned")!
      : null;

  const showingActive =
    active &&
    (active.status === "in_transit" ||
      active.status === "picked_up" ||
      (active.status === "assigned" && activeId === active.id));

  const distForOffer = (d: DriverDelivery) => {
    if (!coords || d.lat == null || d.lng == null) return null;
    return distanceKm(
      { lat: coords.lat, lng: coords.lng },
      { lat: d.lat, lng: d.lng },
    );
  };

  return (
    <DriverMapShell
      online={online}
      onOnlineChange={(v) => void setOnlineState(v)}
      onlineBusy={onlineBusy}
      todayCount={activeJobs.length}
      userLngLat={userLngLat}
      markers={markers}
      routeGeoJSON={showingActive ? route : null}
      onRecenter={() => {
        track();
        setCameraBump((n) => n + 1);
      }}
    >
      <span className="hidden" data-camera={cameraBump} />

      <DriverBottomSheet expanded={!!showingActive || !!offerJob}>
        {!online ? (
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-black/[0.05]">
              <span className="h-3 w-3 rounded-full bg-black/25" />
            </div>
            <h2 className="mt-4 text-[24px] font-semibold tracking-tight">
              You&apos;re offline
            </h2>
            <p className="mx-auto mt-2 max-w-[30ch] text-[14px] leading-relaxed text-black/50">
              Go online to share live location and pull assigned stops onto the
              map.
            </p>
            {locStatus === "denied" ? (
              <p className="mt-3 text-[13px] font-medium text-red-600">
                Location permission denied - enable GPS to track.
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => void setOnlineState(true)}
              className="mt-6 w-full rounded-[18px] bg-[#111] px-4 py-4 text-[15px] font-semibold text-white shadow-[0_10px_28px_rgba(0,0,0,0.18)]"
            >
              Go online
            </button>
          </div>
        ) : showingActive && active ? (
          <>
            {msg ? (
              <p className="mb-3 rounded-xl bg-emerald-500/10 px-3 py-2 text-[13px] font-medium text-emerald-800">
                {msg}
              </p>
            ) : null}
            <ActiveJobCard
              delivery={active}
              distanceKm={
                routeMeta ? routeMeta.distanceM / 1000 : distForOffer(active)
              }
              durationS={routeMeta?.durationS}
              busy={busy}
              otp={otp}
              note={note}
              showPod={active.status === "in_transit"}
              photoUrl={photo}
              onOtpChange={setOtp}
              onNoteChange={setNote}
              onPhoto={setPhoto}
              onSignature={setSignature}
              onPrimary={() => void onPrimary()}
              onNavigate={openExternalNav}
            />
          </>
        ) : offerJob ? (
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#111] px-3 py-1 text-[12px] font-semibold text-white">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                New stop
              </span>
              <span className="text-[13px] font-semibold tabular-nums text-black/45">
                {activeJobs.length} queued
              </span>
            </div>
            <h2 className="mt-3 text-[24px] font-semibold tracking-tight">
              {offerJob.customer_name || "Delivery"}
            </h2>
            <p className="mt-1.5 text-[14px] leading-snug text-black/55">
              {offerJob.address_text || "Address pending"}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-xl bg-black/[0.04] px-3 py-2 text-[13px] font-semibold tabular-nums">
                {distForOffer(offerJob) != null
                  ? formatDistanceKm(distForOffer(offerJob)!)
                  : " - km"}
              </span>
              {routeMeta && offerJob.id === active?.id ? (
                <span className="rounded-xl bg-black/[0.04] px-3 py-2 text-[13px] font-medium text-black/55">
                  {formatDuration(routeMeta.durationS)}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void acceptJob(offerJob.id)}
              className="mt-5 w-full rounded-[18px] bg-[#111] px-4 py-4 text-[15px] font-semibold text-white shadow-[0_10px_28px_rgba(0,0,0,0.18)] disabled:opacity-40"
            >
              {busy ? "Starting…" : "Accept & start"}
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveId(offerJob.id);
                localStorage.setItem(ACTIVE_KEY, offerJob.id);
              }}
              className="mt-2 w-full rounded-[18px] bg-black/[0.05] px-4 py-3.5 text-[13px] font-semibold text-[#111]"
            >
              Preview on map
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3">
              <span className="relative flex h-10 w-10 items-center justify-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/25" />
                <span className="relative h-3 w-3 rounded-full bg-emerald-500" />
              </span>
              <div>
                <h2 className="text-[22px] font-semibold tracking-tight">
                  Looking for jobs
                </h2>
                <p className="text-[13px] text-black/45">
                  Online · {coords ? "GPS locked" : "Finding GPS…"}
                </p>
              </div>
            </div>
            <p className="mt-3 text-[14px] leading-relaxed text-black/50">
              Assigned deliveries from dispatch show up here with live route
              guidance.
            </p>
            {activeJobs.length ? (
              <ul className="mt-4 space-y-2">
                {activeJobs.slice(0, 4).map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => void acceptJob(d.id)}
                      className="flex w-full items-center justify-between gap-3 rounded-2xl bg-black/[0.04] px-3.5 py-3.5 text-left transition active:bg-black/[0.07]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold">
                          {d.customer_name || d.public_id}
                        </p>
                        <p className="mt-0.5 truncate text-[12px] text-black/45">
                          {d.address_text || d.status}
                        </p>
                      </div>
                      <span className="shrink-0 text-[12px] font-semibold text-[#1a73e8]">
                        Start
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-black/12 bg-black/[0.02] px-4 py-5 text-center">
                <p className="text-[13px] text-black/40">
                  No assigned stops yet
                </p>
                <p className="mt-1 text-[11px] tabular-nums text-black/30">
                  {(userLngLat || NAIROBI_CENTER)
                    .map((n) => n.toFixed(3))
                    .join(", ")}
                </p>
              </div>
            )}
          </div>
        )}
      </DriverBottomSheet>
    </DriverMapShell>
  );
}
