"use client";

import dynamic from "next/dynamic";
import ScannerOverlayShell from "@/components/admin/catalogue/scanner/screens/ScannerOverlayShell";

const OfflineScanQueuePanel = dynamic(
  () => import("@/components/admin/catalogue/scanner/OfflineScanQueuePanel"),
  { ssr: false },
);

export type RecentScanEntry = {
  barcode: string;
  name: string;
  brand?: string | null;
  image?: string | null;
  inCatalogue?: boolean;
  at: number;
};

type Props = {
  contextLabel: string;
  recent: RecentScanEntry[];
  onBack: () => void;
  onSelect: (barcode: string) => void;
};

function formatTime(at: number) {
  try {
    return new Date(at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/** Recent scans and offline queue on their own pop-up screen. */
export default function HistoryScreen({
  contextLabel,
  recent,
  onBack,
  onSelect,
}: Props) {
  return (
    <ScannerOverlayShell
      eyebrow={`Scanner · ${contextLabel}`}
      ariaLabel="Scan history"
      dismissKind="back"
      onDismiss={onBack}
      align="top"
    >
      <div className="mx-auto w-full max-w-[560px]">
        <h1 className="text-[clamp(1.5rem,3vw,2rem)] font-medium tracking-tight text-black">
          Recent scans
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-black/45">
          {recent.length
            ? `${recent.length} scan${recent.length === 1 ? "" : "s"} this session — tap one to look it up again.`
            : "Scans from this session will appear here."}
        </p>

        {recent.length ? (
          <div className="mt-8 flex flex-col">
            {recent.map((entry) => (
              <button
                key={`${entry.barcode}-${entry.at}`}
                type="button"
                onClick={() => onSelect(entry.barcode)}
                className="flex min-h-11 w-full items-center justify-between gap-4 border-b border-black/[0.08] py-3.5 text-left transition-opacity hover:opacity-50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-medium tracking-tight text-black/80">
                    {entry.name}
                  </span>
                  <span className="mt-0.5 block font-mono text-[11px] text-black/40">
                    {entry.barcode}
                    {entry.inCatalogue ? " · in catalogue" : ""}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-black/35">
                  {formatTime(entry.at)}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-10 text-[13px] text-black/35">
            No scans yet this session.
          </p>
        )}

        <OfflineScanQueuePanel className="mt-10" />
      </div>
    </ScannerOverlayShell>
  );
}
