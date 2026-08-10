"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
};

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
};

/**
 * Browser barcode entry: BarcodeDetector when available, else camera frame + file upload fallback.
 */
export default function CatalogueBarcodeScanner({
  open,
  onClose,
  onDetected,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) {
      stop();
      return;
    }

    let cancelled = false;
    setError(null);

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const Detector = (
          window as unknown as {
            BarcodeDetector?: new (opts?: {
              formats?: string[];
            }) => BarcodeDetectorLike;
          }
        ).BarcodeDetector;

        if (!Detector) {
          setSupported(false);
          return;
        }

        const detector = new Detector({
          formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "qr_code"],
        });

        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const value = codes[0]?.rawValue;
            if (value) {
              onDetected(value);
              onClose();
              return;
            }
          } catch {
            /* keep scanning */
          }
          rafRef.current = requestAnimationFrame(() => {
            void tick();
          });
        };
        void tick();
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Camera unavailable — enter barcode manually",
        );
        setSupported(false);
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [open, onClose, onDetected, stop]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close scanner"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md border border-black/10 bg-[#f7f7f5]">
        <div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-black/45">
            Scan barcode
          </p>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="relative aspect-[4/3] bg-black">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            playsInline
            muted
          />
          <div className="pointer-events-none absolute inset-8 border border-white/50" />
        </div>
        <div className="space-y-2 px-4 py-3 text-[13px] text-black/55">
          {error ? <p className="text-red-700">{error}</p> : null}
          {!supported ? (
            <p>
              Live detection is not supported in this browser. Point the camera
              or upload a clear barcode photo below, or type the code in the
              search field.
            </p>
          ) : (
            <p className="flex items-center gap-2">
              <Camera className="h-3.5 w-3.5" /> Hold steady over the barcode
            </p>
          )}
          <label
            className={cn(
              "inline-flex cursor-pointer items-center gap-2 border border-black/15 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.14em]",
            )}
          >
            Upload image
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const Detector = (
                    window as unknown as {
                      BarcodeDetector?: new (opts?: {
                        formats?: string[];
                      }) => BarcodeDetectorLike;
                    }
                  ).BarcodeDetector;
                  if (!Detector) {
                    setError("BarcodeDetector unavailable for image decode");
                    return;
                  }
                  const bitmap = await createImageBitmap(file);
                  const detector = new Detector({
                    formats: [
                      "ean_13",
                      "ean_8",
                      "upc_a",
                      "upc_e",
                      "code_128",
                    ],
                  });
                  const codes = await detector.detect(bitmap);
                  bitmap.close();
                  const value = codes[0]?.rawValue;
                  if (value) {
                    onDetected(value);
                    onClose();
                  } else {
                    setError("No barcode found in image");
                  }
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : "Could not read image",
                  );
                }
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
