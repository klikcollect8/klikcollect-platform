"use client";

import { Camera, Navigation, Phone, PenLine } from "lucide-react";
import {
  stepLabel,
  nextStatusAction,
  type DriverDelivery,
} from "@/lib/driver/types";
import { formatDistanceKm, formatDuration } from "@/lib/mapbox";

type ActiveJobCardProps = {
  delivery: DriverDelivery;
  distanceKm?: number | null;
  durationS?: number | null;
  busy?: boolean;
  otp: string;
  note: string;
  showPod: boolean;
  onOtpChange: (v: string) => void;
  onNoteChange: (v: string) => void;
  onPhoto: (dataUrl: string) => void;
  onSignature: (dataUrl: string) => void;
  onPrimary: () => void;
  onNavigate: () => void;
  photoUrl?: string | null;
};

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ActiveJobCard({
  delivery,
  distanceKm,
  durationS,
  busy,
  otp,
  note,
  showPod,
  onOtpChange,
  onNoteChange,
  onPhoto,
  onSignature,
  onPrimary,
  onNavigate,
  photoUrl,
}: ActiveJobCardProps) {
  const action = nextStatusAction(delivery.status);
  const primaryLabel =
    delivery.status === "in_transit" || showPod
      ? "Complete delivery"
      : action?.label || "Continue";

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center bg-amber-500/15 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-amber-900">
          {stepLabel(delivery.status)}
        </span>
        <span className="bg-black/[0.05] px-2.5 py-1 text-[11px] font-medium tabular-nums text-black/45">
          {delivery.public_id}
        </span>
      </div>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[22px] font-medium tracking-tight text-black">
            {delivery.customer_name || "Customer"}
          </h2>
          <p className="mt-1.5 text-[14px] leading-snug text-black/50">
            {delivery.address_text || "Address pending"}
          </p>
        </div>
        <button
          type="button"
          onClick={onNavigate}
          className="flex h-12 w-12 shrink-0 flex-col items-center justify-center bg-black/90 text-white transition hover:bg-black active:scale-95"
          aria-label="Navigate"
        >
          <Navigation className="h-4 w-4" fill="currentColor" />
          <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.12em]">
            Go
          </span>
        </button>
      </div>

      {(distanceKm != null || durationS != null) && (
        <div className="mt-4 flex gap-1.5">
          {distanceKm != null ? (
            <span className="bg-black/[0.05] px-3 py-2 text-[13px] font-medium tabular-nums text-black">
              {formatDistanceKm(distanceKm)}
            </span>
          ) : null}
          {durationS != null ? (
            <span className="bg-black/[0.05] px-3 py-2 text-[13px] font-medium text-black/50">
              {formatDuration(durationS)}
            </span>
          ) : null}
        </div>
      )}

      <div className="mt-4 flex gap-1.5">
        {delivery.customer_phone ? (
          <a
            href={`tel:${delivery.customer_phone}`}
            className="inline-flex flex-1 items-center justify-center gap-2 bg-black/[0.05] px-3 py-3.5 text-[12px] font-medium uppercase tracking-[0.12em] text-black transition hover:bg-black/[0.08]"
          >
            <Phone className="h-4 w-4" />
            Call
          </a>
        ) : (
          <div className="flex-1 bg-black/[0.03] px-3 py-3.5 text-center text-[12px] text-black/35">
            No phone on file
          </div>
        )}
      </div>

      {(delivery.status === "in_transit" || showPod) && (
        <div className="mt-5 space-y-2.5 border-t border-black/[0.06] pt-5">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-black/35">
            Proof of delivery
          </p>
          <input
            className="w-full bg-black/[0.05] px-4 py-3.5 text-[15px] outline-none transition focus:bg-white/50"
            placeholder="OTP code"
            inputMode="numeric"
            value={otp}
            onChange={(e) => onOtpChange(e.target.value)}
          />
          <input
            className="w-full bg-black/[0.05] px-4 py-3.5 text-[15px] outline-none transition focus:bg-white/50"
            placeholder="Delivery note"
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-1.5">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-black/15 bg-black/[0.02] px-3 py-4 text-center transition hover:bg-black/[0.05]">
              <Camera className="h-5 w-5 text-black/40" />
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-black/50">
                Photo
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  void readFileAsDataUrl(file).then(onPhoto);
                }}
              />
            </label>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-black/15 bg-black/[0.02] px-3 py-4 text-center transition hover:bg-black/[0.05]">
              <PenLine className="h-5 w-5 text-black/40" />
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-black/50">
                Signature
              </span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  void readFileAsDataUrl(file).then(onSignature);
                }}
              />
            </label>
          </div>
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt="POD"
              className="h-24 w-full object-cover"
            />
          ) : null}
        </div>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={onPrimary}
        className="mt-5 w-full bg-black/90 px-4 py-4 text-[13px] font-medium uppercase tracking-[0.14em] text-white transition hover:bg-black active:scale-[0.99] disabled:opacity-40"
      >
        {busy ? "Updating…" : primaryLabel}
      </button>
    </div>
  );
}
