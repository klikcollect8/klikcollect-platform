"use client";

import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (localDigits: string) => void;
  error?: string;
  /** ISO dial code shown as prefix — Kenya default */
  countryCode?: string;
  id?: string;
  autoFocus?: boolean;
  className?: string;
};

/**
 * Phone number field with fixed country code prefix (+254).
 * Stores local digits only (e.g. 712345678); parent combines for E.164.
 */
export default function PhoneField({
  value,
  onChange,
  error,
  countryCode = "+254",
  id = "customerPhone",
  autoFocus,
  className,
}: Props) {
  const digits = value.replace(/\D/g, "").replace(/^254/, "").replace(/^0/, "");

  return (
    <label className={cn("block space-y-2", className)}>
      <span className="text-[12px] text-black/40">Phone</span>
      <div
        className={cn(
          "flex items-end gap-3 border-b border-black/15 focus-within:border-black/40",
          error && "border-red-400 focus-within:border-red-500",
        )}
      >
        <span className="shrink-0 py-3 text-[17px] tabular-nums text-black/55">
          {countryCode}
        </span>
        <input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          autoFocus={autoFocus}
          value={digits}
          onChange={(e) => {
            const next = e.target.value.replace(/\D/g, "").slice(0, 9);
            onChange(next);
          }}
          placeholder="7XX XXX XXX"
          className="w-full bg-transparent py-3 text-[17px] outline-none placeholder:text-black/25"
        />
      </div>
      {error ? <p className="text-[12px] text-red-600">{error}</p> : null}
      <p className="text-[11px] text-black/35">Kenya mobile · M-Pesa ready</p>
    </label>
  );
}

/** Combine UI local digits with Kenya country code for APIs. */
export function toKenyaPhoneE164(localDigits: string): string {
  const d = localDigits.replace(/\D/g, "");
  if (d.startsWith("254") && d.length >= 12) return d;
  if (d.startsWith("0") && d.length === 10) return `254${d.slice(1)}`;
  if (d.length === 9 && d.startsWith("7")) return `254${d}`;
  return d.length ? `254${d.replace(/^0/, "")}` : "";
}
