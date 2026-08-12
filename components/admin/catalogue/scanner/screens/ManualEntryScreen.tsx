"use client";

import { useEffect, useRef, useState } from "react";
import ScannerOverlayShell from "@/components/admin/catalogue/scanner/screens/ScannerOverlayShell";

type Props = {
  contextLabel: string;
  onBack: () => void;
  onSubmit: (code: string) => void;
};

/**
 * Dedicated manual-entry pop-up screen. Also serves USB / Bluetooth wedge
 * scanners: the field keeps focus and a hardware scan submits on Enter.
 */
export default function ManualEntryScreen({
  contextLabel,
  onBack,
  onSubmit,
}: Props) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, []);

  const submit = () => {
    const code = value.trim();
    if (!code) return;
    setValue("");
    onSubmit(code);
  };

  return (
    <ScannerOverlayShell
      eyebrow={`Scanner · ${contextLabel}`}
      ariaLabel="Enter a barcode"
      dismissKind="back"
      onDismiss={onBack}
    >
      <div className="w-full max-w-[380px] text-center">
        <h1 className="text-[clamp(1.5rem,3vw,2rem)] font-medium tracking-tight text-black">
          Enter a barcode
        </h1>
        <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-black/45">
          Type the GTIN, EAN, or UPC printed under the barcode.
        </p>

        <form
          className="mt-8"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <label
            htmlFor="scanner-manual-code"
            className="block text-left text-[11px] font-medium uppercase tracking-[0.18em] text-black/35"
          >
            Barcode
          </label>
          <input
            id="scanner-manual-code"
            ref={inputRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            inputMode="numeric"
            placeholder="e.g. 6161100530146"
            className="w-full border-0 border-b border-black/15 bg-transparent px-0 py-3.5 text-center font-mono text-[20px] tracking-wide text-black outline-none placeholder:font-sans placeholder:text-[15px] placeholder:tracking-normal placeholder:text-black/30 focus:border-black/50"
          />
          <button
            type="submit"
            disabled={!value.trim()}
            className="mt-6 flex h-12 w-full items-center justify-center bg-black text-[12px] font-medium uppercase tracking-[0.14em] text-white transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            Look up
          </button>
        </form>

        <p className="mt-8 text-[12px] leading-relaxed text-black/35">
          Using a USB or Bluetooth scanner? Keep this field focused — the scan
          types itself and submits on Enter.
        </p>
      </div>
    </ScannerOverlayShell>
  );
}
