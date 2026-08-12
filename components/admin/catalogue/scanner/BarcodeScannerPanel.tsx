"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  Flashlight,
  Keyboard,
  Loader2,
  RefreshCw,
  ScanBarcode,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatFromScannerLibrary,
  normaliseBarcode,
} from "@/lib/catalogue/barcode-normalize";

export type ScannerDetectMeta = {
  format?: string;
  source: "camera" | "hardware" | "manual";
};

type Props = {
  /** When false, camera stays stopped (e.g. modal closed). Default true for embedded use. */
  active?: boolean;
  className?: string;
  /** Full-bleed camera for warehouse scanner page. */
  fullscreen?: boolean;
  /** Hide built-in header (parent provides chrome). */
  hideHeader?: boolean;
  /** Auto-emit on first valid decode (warehouse flow). */
  autoSubmit?: boolean;
  onDetected: (code: string, meta?: ScannerDetectMeta) => void;
};

type ZXingModule = typeof import("@zxing/browser");
type ZXingLib = typeof import("@zxing/library");

/**
 * Advanced barcode panel: ZXing continuous decode, device picker, torch,
 * hardware wedge, and manual entry. ZXing is loaded only in the browser.
 */
export default function BarcodeScannerPanel({
  active = true,
  className,
  fullscreen = false,
  hideHeader = false,
  autoSubmit = true,
  onDetected,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const readerRef = useRef<{ reset?: () => void } | null>(null);
  const pausedRef = useRef(false);
  const lastCodeRef = useRef("");
  const lastAtRef = useRef(0);
  const hardwareRef = useRef<HTMLInputElement>(null);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const [mode, setMode] = useState<"camera" | "hardware">("camera");
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [zoomSupported, setZoomSupported] = useState(false);
  const [zoomMax, setZoomMax] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [paused, setPaused] = useState(false);
  const [lastDetected, setLastDetected] = useState<{
    value: string;
    format: string;
  } | null>(null);
  const [manual, setManual] = useState("");
  const [hardware, setHardware] = useState("");
  const [engine, setEngine] = useState<"zxing" | "loading" | "unavailable">(
    "loading",
  );

  const stopCamera = useCallback(() => {
    try {
      controlsRef.current?.stop();
    } catch {
      /* ignore */
    }
    controlsRef.current = null;
    try {
      readerRef.current?.reset?.();
    } catch {
      /* ignore */
    }
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setTorchOn(false);
    setTorchSupported(false);
  }, []);

  const emit = useCallback(
    (
      raw: string,
      formatHint: string | undefined,
      source: ScannerDetectMeta["source"],
      opts?: { force?: boolean },
    ) => {
      const n = normaliseBarcode(raw, { formatHint });
      // Camera / hardware: only emit valid GTINs. Manual can force-submit.
      if (!n.valid && !opts?.force) {
        setError(n.error || "Invalid barcode checksum — enter manually to force");
        setLastDetected({
          value: n.value || raw,
          format: formatHint || n.format || "unknown",
        });
        return;
      }
      const value = n.valid ? n.value : n.value || raw.replace(/\D/g, "") || raw;
      if (!value || value.length < 6) {
        setError(n.error || "Invalid barcode");
        return;
      }
      const now = Date.now();
      if (value === lastCodeRef.current && now - lastAtRef.current < 1800) {
        return;
      }
      lastCodeRef.current = value;
      lastAtRef.current = now;
      const format = formatHint || n.format;
      setLastDetected({ value, format });
      setError(
        n.valid
          ? null
          : "Checksum invalid — submitting anyway for manual review",
      );

      if (source === "camera") {
        pausedRef.current = true;
        setPaused(true);
        try {
          controlsRef.current?.stop();
        } catch {
          /* ignore */
        }
      }

      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate(n.valid ? 35 : [20, 40, 20]);
        } catch {
          /* ignore */
        }
      }

      // Short beep on successful valid decode
      if (n.valid && typeof window !== "undefined") {
        try {
          const Ctx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext?: typeof AudioContext })
              .webkitAudioContext;
          if (Ctx) {
            const ctx = new Ctx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.value = 880;
            gain.gain.value = 0.04;
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.08);
            void ctx.close();
          }
        } catch {
          /* ignore */
        }
      }

      if (autoSubmit || source !== "camera" || opts?.force) {
        onDetectedRef.current(value, { format, source });
      }
    },
    [autoSubmit],
  );

  const startCamera = useCallback(async () => {
    if (!active || mode !== "camera" || !videoRef.current) return;
    if (typeof window === "undefined") return;

    setStarting(true);
    setError(null);
    pausedRef.current = false;
    setPaused(false);
    setLastDetected(null);
    stopCamera();

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setEngine("unavailable");
        setError(
          "This browser cannot access the camera. Use Chrome/Edge on HTTPS (or localhost), or switch to Hardware / Manual entry.",
        );
        setStarting(false);
        return;
      }

      setEngine("loading");
      const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] =
        await Promise.all([
          import("@zxing/browser") as Promise<ZXingModule>,
          import("@zxing/library") as Promise<ZXingLib>,
        ]);

      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.ITF,
        BarcodeFormat.QR_CODE,
        BarcodeFormat.DATA_MATRIX,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);

      const reader = new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 80,
        delayBetweenScanSuccess: 1200,
      });
      readerRef.current = reader as { reset?: () => void };

      let list: MediaDeviceInfo[] = [];
      try {
        // Warm permission so labels populate
        const warm = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" } },
        });
        warm.getTracks().forEach((t) => t.stop());
        list = await BrowserMultiFormatReader.listVideoInputDevices();
      } catch (permErr) {
        const msg =
          permErr instanceof Error ? permErr.message : "Camera permission denied";
        setEngine("unavailable");
        setError(
          `${msg}. Allow camera access, or use Hardware / Manual entry below.`,
        );
        setStarting(false);
        return;
      }

      setDevices(list);
      let preferred = deviceId;
      if (!preferred || !list.some((d) => d.deviceId === preferred)) {
        const back = list.find((d) =>
          /back|rear|environment|world/i.test(d.label || ""),
        );
        preferred = back?.deviceId || list[list.length - 1]?.deviceId || "";
        setDeviceId(preferred);
      }

      const videoEl = videoRef.current;
      if (!videoEl) {
        setStarting(false);
        return;
      }

      const controls = preferred
        ? await reader.decodeFromVideoDevice(
            preferred,
            videoEl,
            (result, _err, ctrl) => {
              controlsRef.current = ctrl;
              if (!result || pausedRef.current) return;
              const text = result.getText();
              const fmtNum = result.getBarcodeFormat();
              const fmtName =
                (BarcodeFormat as unknown as Record<number, string>)[fmtNum] ||
                String(fmtNum);
              emit(text, formatFromScannerLibrary(fmtName), "camera");
            },
          )
        : await reader.decodeFromConstraints(
            {
              audio: false,
              video: {
                facingMode: { ideal: "environment" },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
            },
            videoEl,
            (result, _err, ctrl) => {
              controlsRef.current = ctrl;
              if (!result || pausedRef.current) return;
              const text = result.getText();
              const fmtNum = result.getBarcodeFormat();
              const fmtName =
                (BarcodeFormat as unknown as Record<number, string>)[fmtNum] ||
                String(fmtNum);
              emit(text, formatFromScannerLibrary(fmtName), "camera");
            },
          );

      controlsRef.current = controls;
      setEngine("zxing");
      setReady(true);

      const stream = videoEl.srcObject as MediaStream | null;
      const track = stream?.getVideoTracks()?.[0];
      const caps = track?.getCapabilities?.() as {
        torch?: boolean;
        zoom?: { min?: number; max?: number };
      } | undefined;
      setTorchSupported(Boolean(caps?.torch));
      const zMax = caps?.zoom?.max;
      if (typeof zMax === "number" && zMax > 1) {
        setZoomSupported(true);
        setZoomMax(zMax);
        setZoom(1);
      } else {
        setZoomSupported(false);
        setZoomMax(1);
        setZoom(1);
      }
    } catch (e) {
      setEngine("unavailable");
      const raw = e instanceof Error ? e.message : String(e);
      setError(
        /NotAllowedError|Permission/i.test(raw)
          ? "Camera permission blocked. Allow camera for this site, or use Hardware / Manual entry."
          : /NotFoundError|DevicesNotFound/i.test(raw)
            ? "No camera found. Plug in a webcam or use Hardware / Manual entry."
            : `Camera could not start (${raw}). Use Hardware or Manual entry.`,
      );
    } finally {
      setStarting(false);
    }
  }, [active, deviceId, emit, mode, stopCamera]);

  useEffect(() => {
    if (!active) {
      stopCamera();
      return;
    }
    if (mode === "camera") {
      void startCamera();
    } else {
      stopCamera();
      requestAnimationFrame(() => hardwareRef.current?.focus());
    }
    return () => stopCamera();
    // Intentionally omit startCamera to avoid restart loops; deviceId/mode/active drive restarts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, mode, deviceId]);

  const toggleTorch = async () => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    const track = stream?.getVideoTracks()?.[0];
    if (!track) return;
    try {
      await track.applyConstraints({
        // MediaTrackConstraintSet.torch is widely supported on Android Chrome
        advanced: [{ torch: !torchOn } as unknown as MediaTrackConstraintSet],
      });
      setTorchOn((v) => !v);
    } catch {
      setError("Flashlight is not available on this camera");
    }
  };

  const applyZoom = async (value: number) => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    const track = stream?.getVideoTracks()?.[0];
    if (!track) return;
    try {
      await track.applyConstraints({
        advanced: [{ zoom: value } as unknown as MediaTrackConstraintSet],
      });
      setZoom(value);
    } catch {
      setZoomSupported(false);
    }
  };

  const submitEntry = (source: "hardware" | "manual") => {
    const v = (source === "hardware" ? hardware : manual).trim();
    if (!v) return;
    // Manual entry may force-submit invalid checksums for review
    emit(v, undefined, source, { force: source === "manual" });
    if (source === "hardware") setHardware("");
    else setManual("");
  };

  return (
    <div
      className={cn(
        "overflow-hidden bg-white",
        fullscreen ? "flex h-full flex-col border-0" : "border border-slate-200",
        className,
      )}
    >
      {!hideHeader ? (
        <div className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <ScanBarcode className="h-4 w-4 text-black/50" />
            <p className="text-[11px] uppercase tracking-[0.16em] text-black/45">
              Live barcode scanner
            </p>
          </div>
          <p className="text-[11px] text-black/40">
            {engine === "zxing"
              ? "ZXing engine"
              : engine === "loading"
                ? "Loading engine…"
                : "Camera offline"}
          </p>
        </div>
      ) : null}

      <div className="flex gap-2 border-b border-black/10 px-4 py-2">
        <button
          type="button"
          className={cn(
            "flex-1 py-2 text-[11px] font-medium uppercase tracking-[0.12em]",
            mode === "camera" ? "bg-black text-white" : "border border-black/15",
          )}
          onClick={() => setMode("camera")}
        >
          Camera
        </button>
        <button
          type="button"
          className={cn(
            "flex-1 py-2 text-[11px] font-medium uppercase tracking-[0.12em]",
            mode === "hardware"
              ? "bg-black text-white"
              : "border border-black/15",
          )}
          onClick={() => setMode("hardware")}
        >
          Hardware wedge
        </button>
      </div>

      {mode === "camera" ? (
        <>
          <div
            className={cn(
              "relative bg-black",
              fullscreen ? "min-h-0 flex-1" : "aspect-[4/3] sm:aspect-[16/10]",
            )}
          >
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              playsInline
              muted
              autoPlay
            />
            <div className="pointer-events-none absolute inset-[16%] rounded-sm border-2 border-white/75 shadow-[0_0_0_9999px_rgba(0,0,0,0.38)]" />
            {(starting || engine === "loading") && !error ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 text-white">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p className="text-[13px]">Starting ZXing camera…</p>
              </div>
            ) : null}
            {paused && lastDetected ? (
              <div className="absolute inset-x-4 bottom-4 space-y-2 bg-black/80 px-3 py-3 text-center text-white">
                <p className="text-[12px] uppercase tracking-[0.14em] text-white/70">
                  Detected · {lastDetected.format.replace(/_/g, "-")}
                </p>
                <p className="font-mono text-[18px] tracking-wide">
                  {lastDetected.value}
                </p>
                {!autoSubmit ? (
                  <button
                    type="button"
                    className="mt-1 bg-white px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-black"
                    onClick={() =>
                      onDetectedRef.current(lastDetected.value, {
                        format: lastDetected.format,
                        source: "camera",
                      })
                    }
                  >
                    Use this code
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            {devices.length > 1 ? (
              <select
                className="min-w-0 flex-1 border border-black/15 bg-transparent px-2 py-2 text-[12px]"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
              >
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera ${d.deviceId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            ) : null}
            {torchSupported ? (
              <button
                type="button"
                onClick={() => void toggleTorch()}
                className={cn(
                  "inline-flex items-center gap-1.5 border px-3 py-2 text-[11px] uppercase tracking-[0.12em]",
                  torchOn
                    ? "border-black bg-black text-white"
                    : "border-black/15",
                )}
              >
                <Flashlight className="h-3.5 w-3.5" /> Torch
              </button>
            ) : null}
            {zoomSupported ? (
              <label className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-black/50">
                Zoom
                <input
                  type="range"
                  min={1}
                  max={zoomMax}
                  step={0.1}
                  value={zoom}
                  className="w-24"
                  onChange={(e) => void applyZoom(Number(e.target.value))}
                />
              </label>
            ) : null}
            <button
              type="button"
              className="inline-flex items-center gap-1.5 border border-black/15 px-3 py-2 text-[11px] uppercase tracking-[0.12em]"
              onClick={() => void startCamera()}
              disabled={starting}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {paused ? "Scan again" : "Restart"}
            </button>
            {!paused && ready && !error ? (
              <p className="flex items-center gap-2 text-[12px] text-black/50">
                <Camera className="h-3.5 w-3.5" /> Align barcode in the frame
              </p>
            ) : null}
          </div>
        </>
      ) : (
        <div className="space-y-3 px-4 py-6">
          <p className="flex items-center gap-2 text-[13px] text-black/55">
            <Keyboard className="h-4 w-4" />
            USB / Bluetooth scanner ready — focus stays here; scan then Enter
          </p>
          <input
            ref={hardwareRef}
            autoFocus
            className="h-12 w-full border-0 border-b border-black/20 bg-transparent font-mono text-[20px] tracking-wide outline-none"
            placeholder="Waiting for hardware scan…"
            value={hardware}
            onChange={(e) => setHardware(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitEntry("hardware");
              }
            }}
          />
        </div>
      )}

      <div className="space-y-2 border-t border-black/10 px-4 py-3">
        {error ? (
          <p className="text-[13px] leading-snug text-red-700">{error}</p>
        ) : null}
        <label className="block text-[11px] uppercase tracking-[0.14em] text-black/40">
          Manual entry
        </label>
        <div className="flex gap-2">
          <input
            className="h-11 min-w-0 flex-1 border border-black/15 bg-transparent px-3 font-mono text-[15px] outline-none"
            placeholder="EAN-13 / UPC / GTIN"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitEntry("manual");
              }
            }}
          />
          <button
            type="button"
            className="bg-black px-4 text-[11px] font-medium uppercase tracking-[0.12em] text-white disabled:opacity-40"
            disabled={!manual.trim()}
            onClick={() => submitEntry("manual")}
          >
            Look up
          </button>
        </div>
      </div>
    </div>
  );
}
