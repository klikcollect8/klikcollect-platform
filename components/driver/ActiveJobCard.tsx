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
        <span className="inline-flex items-center rounded-full bg-amber-500/12 px-3 py-1 text-[12px] font-semibold text-amber-800">
          {stepLabel(delivery.status)}
        </span>
        <span className="rounded-full bg-black/[0.04] px-2.5 py-1 text-[11px] font-medium tabular-nums text-black/45">
          {delivery.public_id}
        </span>
      </div>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[24px] font-semibold tracking-tight text-[#111]">
            {delivery.customer_name || "Customer"}
          </h2>
          <p className="mt-1.5 text-[14px] leading-snug text-black/55">
            {delivery.address_text || "Address pending"}
          </p>
        </div>
        <button
          type="button"
          onClick={onNavigate}
          className="flex h-[52px] w-[52px] shrink-0 flex-col items-center justify-center rounded-2xl bg-[#1a73e8] text-white shadow-[0_8px_20px_rgba(26,115,232,0.35)] transition active:scale-95"
          aria-label="Navigate"
        >
          <Navigation className="h-5 w-5" fill="currentColor" />
          <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wide">
            Go
          </span>
        </button>
      </div>

      {(distanceKm != null || durationS != null) && (
        <div className="mt-4 flex gap-2">
          {distanceKm != null ? (
            <span className="rounded-xl bg-black/[0.04] px-3 py-2 text-[13px] font-semibold tabular-nums text-[#111]">
              {formatDistanceKm(distanceKm)}
            </span>
          ) : null}
          {durationS != null ? (
            <span className="rounded-xl bg-black/[0.04] px-3 py-2 text-[13px] font-medium text-black/55">
              {formatDuration(durationS)}
            </span>
          ) : null}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        {delivery.customer_phone ? (
          <a
            href={`tel:${delivery.customer_phone}`}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-black/[0.04] px-3 py-3.5 text-[13px] font-semibold text-[#111] transition active:bg-black/[0.07]"
          >
            <Phone className="h-4 w-4" />
            Call
          </a>
        ) : (
          <div className="flex-1 rounded-2xl bg-black/[0.03] px-3 py-3.5 text-center text-[12px] text-black/35">
            No phone on file
          </div>
        )}
      </div>

      {(delivery.status === "in_transit" || showPod) && (
        <div className="mt-5 space-y-3 border-t border-black/[0.06] pt-5">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-black/35">
            Proof of delivery
          </p>
          <input
            className="w-full rounded-2xl bg-black/[0.04] px-4 py-3.5 text-[15px] outline-none ring-black/10 transition focus:bg-white focus:ring-2"
            placeholder="OTP code"
            inputMode="numeric"
            value={otp}
            onChange={(e) => onOtpChange(e.target.value)}
          />
          <input
            className="w-full rounded-2xl bg-black/[0.04] px-4 py-3.5 text-[15px] outline-none ring-black/10 transition focus:bg-white focus:ring-2"
            placeholder="Delivery note"
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-black/15 bg-black/[0.02] px-3 py-4 text-center transition hover:bg-black/[0.04]">
              <Camera className="h-5 w-5 text-black/40" />
              <span className="text-[12px] font-medium text-black/55">
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
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-black/15 bg-black/[0.02] px-3 py-4 text-center transition hover:bg-black/[0.04]">
              <PenLine className="h-5 w-5 text-black/40" />
              <span className="text-[12px] font-medium text-black/55">
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
              className="h-24 w-full rounded-2xl object-cover"
            />
          ) : null}
        </div>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={onPrimary}
        className="mt-5 w-full rounded-[18px] bg-[#111] px-4 py-4 text-[15px] font-semibold text-white shadow-[0_10px_28px_rgba(0,0,0,0.18)] transition active:scale-[0.99] disabled:opacity-40"
      >
        {busy ? "Updating…" : primaryLabel}
      </button>
    </div>
  );
}
