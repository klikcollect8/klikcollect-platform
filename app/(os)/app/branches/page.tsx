"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/os/ModuleShell";
import BranchLocationEditor, {
  type BranchLocationValue,
} from "@/components/os/BranchLocationEditor";
import { osUi } from "@/components/os/os-ui";
import { cn } from "@/lib/utils";

type Branch = {
  id: string;
  public_id: string;
  name: string;
  neighbourhood: string | null;
  address_text: string | null;
  is_primary: boolean;
  lat: number | null;
  lng: number | null;
  manager_clerk_id: string | null;
  phone: string | null;
  place_id: string | null;
  location_verified: boolean | null;
  location_confidence: string | null;
  location_updated_at: string | null;
  pos_meta?: Record<string, unknown>;
};

const EMPTY_LOCATION: BranchLocationValue = {
  lat: null,
  lng: null,
  placeId: null,
  locationVerified: false,
  addressLabel: null,
};

export default function BranchesPage() {
  const [vendorId, setVendorId] = useState("");
  const [rows, setRows] = useState<Branch[]>([]);
  const missingPins = rows.filter(
    (r) => r.lat == null || r.lng == null || !Number.isFinite(Number(r.lat)),
  );
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [neighbourhood, setNeighbourhood] = useState("");
  const [newLocation, setNewLocation] =
    useState<BranchLocationValue>(EMPTY_LOCATION);
  const [editId, setEditId] = useState<string | null>(null);
  const [managerId, setManagerId] = useState("");
  const [phone, setPhone] = useState("");
  const [editLocation, setEditLocation] =
    useState<BranchLocationValue>(EMPTY_LOCATION);
  const [editHadPin, setEditHadPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = (vid: string) =>
    void fetch(`/api/os/branches?vendorId=${encodeURIComponent(vid)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error.message || "Failed to load");
        else setRows(j.data || []);
      });

  useEffect(() => {
    void fetch("/api/os/me")
      .then((r) => r.json())
      .then((b) => {
        const id = b?.data?.vendorIds?.[0] || "";
        setVendorId(id);
        if (id) load(id);
      });
  }, []);

  const create = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/os/branches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vendorId,
        name,
        address: address || newLocation.addressLabel || "",
        neighbourhood,
        lat: newLocation.lat,
        lng: newLocation.lng,
        placeId: newLocation.placeId ?? null,
        locationVerified: !!newLocation.locationVerified,
      }),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(j.error?.message || "Create failed");
      return;
    }
    setName("");
    setAddress("");
    setNeighbourhood("");
    setNewLocation(EMPTY_LOCATION);
    load(vendorId);
  };

  const startEdit = (b: Branch) => {
    setEditId(b.id);
    setManagerId(b.manager_clerk_id || "");
    setPhone(b.phone || "");
    const hasPin = b.lat != null && b.lng != null;
    setEditHadPin(hasPin);
    setEditLocation({
      lat: b.lat,
      lng: b.lng,
      placeId: b.place_id,
      locationVerified: !!b.location_verified,
      addressLabel: b.address_text,
    });
  };

  const saveEdit = async () => {
    if (!editId) return;
    setBusy(true);
    setError(null);
    const clearing =
      editHadPin && editLocation.lat == null && editLocation.lng == null;
    const res = await fetch("/api/os/branches", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vendorId,
        id: editId,
        managerClerkId: managerId,
        phone,
        ...(clearing
          ? { clearLocation: true }
          : {
              lat: editLocation.lat,
              lng: editLocation.lng,
              placeId: editLocation.placeId ?? null,
              locationVerified: !!editLocation.locationVerified,
            }),
      }),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(j.error?.message || "Update failed");
      return;
    }
    setEditId(null);
    load(vendorId);
  };

  return (
    <ModuleShell
      title="Branches"
      description="Store locations for cashiers, pickup, and inventory scope."
      live
    >
      {error ? (
        <p className={cn("mb-4 text-[13px]", osUi.danger)}>{error}</p>
      ) : null}

      {missingPins.length ? (
        <div className="mb-4 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-3 text-[13px] text-amber-950">
          Set a map pin so customers can find you. {missingPins.length} branch
          {missingPins.length === 1 ? "" : "es"} missing a location.
        </div>
      ) : null}

      <div className="grid gap-3 border-b border-black/10 pb-6 sm:grid-cols-2">
        <input
          className={osUi.input}
          placeholder="Branch name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className={osUi.input}
          placeholder="Neighbourhood"
          value={neighbourhood}
          onChange={(e) => setNeighbourhood(e.target.value)}
        />
        <input
          className={cn(osUi.input, "sm:col-span-2")}
          placeholder="Address (optional — filled from the map pin)"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <BranchLocationEditor
          className="sm:col-span-2"
          value={newLocation}
          onChange={setNewLocation}
          branchName={name || undefined}
          siblings={rows.map((r) => ({
            id: r.id,
            name: r.name,
            lat: r.lat,
            lng: r.lng,
          }))}
        />
        <button
          type="button"
          disabled={busy || !name || !vendorId}
          onClick={() => void create()}
          className={cn(osUi.btnPrimary, "sm:col-span-2")}
        >
          Add branch
        </button>
      </div>

      <div className="mt-6 divide-y divide-black/[0.06]">
        {rows.map((b) => (
          <div key={b.id} className="py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[15px] font-medium text-black">{b.name}</p>
                <p className={cn("mt-1 text-[13px]", osUi.muted)}>
                  {[b.neighbourhood, b.address_text]
                    .filter(Boolean)
                    .join(" · ") || " - "}
                </p>
                <p
                  className={cn(
                    "mt-1 text-[11px] uppercase tracking-wider",
                    osUi.muted,
                  )}
                >
                  {b.public_id}
                  {b.lat != null && b.lng != null
                    ? ` · ${b.lat.toFixed(4)}, ${b.lng.toFixed(4)}`
                    : " · no pin"}
                  {b.lat != null && b.location_verified ? " · verified" : ""}
                </p>
                {b.manager_clerk_id || b.phone ? (
                  <p className={cn("mt-1 text-[12px]", osUi.muted)}>
                    {[
                      b.manager_clerk_id && `Mgr ${b.manager_clerk_id}`,
                      b.phone,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                {b.is_primary ? (
                  <span
                    className={cn(
                      "text-[11px] uppercase tracking-wider",
                      osUi.muted,
                    )}
                  >
                    Primary
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => startEdit(b)}
                  className={osUi.btnGhost}
                >
                  Edit
                </button>
              </div>
            </div>

            {editId === b.id ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <input
                  className={osUi.input}
                  placeholder="Manager Clerk user id"
                  value={managerId}
                  onChange={(e) => setManagerId(e.target.value)}
                />
                <input
                  className={osUi.input}
                  placeholder="Phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <BranchLocationEditor
                  className="sm:col-span-2"
                  value={editLocation}
                  onChange={setEditLocation}
                  branchName={b.name}
                  siblings={rows
                    .filter((r) => r.id !== b.id)
                    .map((r) => ({
                      id: r.id,
                      name: r.name,
                      lat: r.lat,
                      lng: r.lng,
                    }))}
                />
                <div className="flex gap-2 sm:col-span-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void saveEdit()}
                    className={osUi.btnPrimary}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditId(null)}
                    className={osUi.btnGhost}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ))}
        {!rows.length ? (
          <p className={cn("py-6 text-[14px]", osUi.muted)}>No branches yet.</p>
        ) : null}
      </div>
    </ModuleShell>
  );
}
