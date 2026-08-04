"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { CloseIcon } from "@/components/NavIcons";
import {
  CURATION_MAX_EDITS,
  type CurationApplication,
} from "@/lib/curation-policy";
import { pushCustomerNotification } from "@/lib/customer-notifications";
import { useIsClient } from "@/lib/hooks/useIsClient";
import SellApplicationPanel from "@/components/SellApplicationPanel";

function formatWhen(iso?: string) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("en-KE", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function statusHeadline(status: CurationApplication["status"]) {
  if (status === "admitted") return "You're in.";
  if (status === "rejected") return "Not this round.";
  return "In review.";
}

function statusSubcopy(status: CurationApplication["status"]) {
  if (status === "admitted")
    return "Your shop was admitted. Next steps will arrive by email.";
  if (status === "rejected")
    return "Thanks for applying. Future applications will show here.";
  return "We're checking quality, fulfilment, and legitimacy.";
}

const STEPS = [
  {
    id: "submitted",
    label: "Submitted",
    detail: (app: CurationApplication) => formatWhen(app.createdAt),
  },
  {
    id: "review",
    label: "In review",
    detail: (app: CurationApplication) =>
      app.status === "pending" ? "Live" : "Complete",
  },
  {
    id: "decision",
    label: "Decision",
    detail: (app: CurationApplication) =>
      app.status === "pending"
        ? "Waiting"
        : app.status === "admitted"
          ? "Admitted"
          : "Not admitted",
  },
] as const;

function activeIndex(status: CurationApplication["status"]) {
  return status === "pending" ? 1 : 2;
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onApply?: () => void;
};

export default function SellApplicationTrackerPanel({
  isOpen,
  onClose,
  onApply,
}: Props) {
  const mounted = useIsClient();
  const [isVisible, setIsVisible] = useState(false);
  const [apps, setApps] = useState<CurationApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editApp, setEditApp] = useState<CurationApplication | null>(null);
  const seenStatusRef = useRef<Record<string, string>>({});

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/curation/mine", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || "Could not load application");
        setApps([]);
        return;
      }
      const list = (json.data?.applications || []) as CurationApplication[];
      setApps(list);
      setError("");

      const latest = list[0];
      if (latest) {
        const prev = seenStatusRef.current[latest.id];
        if (prev && prev === "pending" && latest.status !== "pending") {
          pushCustomerNotification({
            id: `sell-decision-${latest.id}-${latest.status}`,
            title:
              latest.status === "admitted"
                ? "Sell application admitted"
                : "Sell application update",
            body:
              latest.status === "admitted"
                ? `${latest.businessName} was admitted. Next steps will follow by email.`
                : `${latest.businessName} was not admitted this round.`,
            href: "/account/sell-application",
          });
        }
        seenStatusRef.current[latest.id] = latest.status;
      }
    } catch {
      setError("Could not load application");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setIsVisible(false);
      setEditApp(null);
      document.body.style.overflow = "";
      return;
    }

    void load();
    const interval = window.setInterval(() => void load(true), 8000);
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsVisible(true));
    });
    document.body.style.overflow = "hidden";

    return () => {
      window.clearInterval(interval);
      cancelAnimationFrame(raf);
      document.body.style.overflow = "";
    };
  }, [isOpen, load]);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(onClose, 280);
  }, [onClose]);

  useEffect(() => {
    if (!isOpen || editApp) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, editApp, handleClose]);

  if (!mounted || !isOpen || typeof document === "undefined") return null;

  const latest = apps[0] || null;
  const editsLeft = latest
    ? Math.max(0, CURATION_MAX_EDITS - (latest.editCount || 0))
    : 0;
  const canEdit = !!latest && latest.status === "pending" && editsLeft > 0;
  const current = latest ? activeIndex(latest.status) : -1;

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sell application tracking"
      className={`fixed inset-0 z-[9998] bg-[#f7f7f5] transition-opacity duration-300 ease-out ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="relative mx-auto flex h-full w-full max-w-[1100px] flex-col px-6 sm:px-10 lg:px-16">
        <header className="flex shrink-0 items-center justify-between pt-6 sm:pt-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-black/35">
            Tracking
          </p>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 text-[13px] text-black/40 transition-colors hover:text-black"
            aria-label="Close"
          >
            <span className="hidden sm:inline">Esc</span>
            <CloseIcon size={20} />
          </button>
        </header>

        <div
          className={`scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-contain py-12 transition-all duration-500 ease-out sm:py-16 lg:py-20 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
          }`}
        >
          {loading ? (
            <div className="flex min-h-[50vh] flex-col justify-center">
              <h2 className="text-[clamp(2rem,5vw,3.25rem)] font-medium leading-[1.05] tracking-[-0.035em] text-black/80">
                Loading…
              </h2>
            </div>
          ) : error ? (
            <div className="flex min-h-[50vh] flex-col justify-center">
              <h2 className="text-[clamp(2rem,5vw,3.25rem)] font-medium leading-[1.05] tracking-[-0.035em]">
                Couldn&apos;t load
              </h2>
              <p className="mt-5 max-w-md text-[15px] leading-relaxed text-black/45">
                {error}
              </p>
              <button
                type="button"
                onClick={() => void load()}
                className="mt-10 text-[13px] text-black/45 underline underline-offset-[6px] decoration-black/20 transition-colors hover:text-black hover:decoration-black"
              >
                Try again
              </button>
            </div>
          ) : !latest ? (
            <div className="flex min-h-[50vh] flex-col justify-center">
              <h2 className="text-[clamp(2rem,5vw,3.25rem)] font-medium leading-[1.05] tracking-[-0.035em]">
                No application yet.
              </h2>
              <p className="mt-5 max-w-md text-[15px] leading-relaxed text-black/45">
                Status will appear here after you apply to sell.
              </p>
            </div>
          ) : (
            <div className="grid gap-16 lg:grid-cols-12 lg:gap-20 lg:items-start">
              <div className="lg:col-span-6">
                <p className="text-[13px] text-black/40">{latest.businessName}</p>
                <h2 className="mt-4 text-[clamp(2.25rem,5.5vw,3.75rem)] font-medium leading-[1.02] tracking-[-0.04em]">
                  {statusHeadline(latest.status)}
                </h2>
                <p className="mt-6 max-w-sm text-[15px] leading-relaxed text-black/45 sm:text-[16px]">
                  {statusSubcopy(latest.status)}
                </p>
                <p className="mt-10 text-[12px] tracking-[0.08em] text-black/30">
                  {latest.id}
                </p>
              </div>

              <div className="lg:col-span-6 lg:pt-2">
                <ol className="space-y-0">
                  {STEPS.map((step, i) => {
                    const done = i < current;
                    const active = i === current;
                    const muted = i > current;
                    const last = i === STEPS.length - 1;

                    return (
                      <li key={step.id} className="flex gap-5">
                        <div className="flex w-3 shrink-0 flex-col items-center pt-1.5">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              active || done ? "bg-black" : "bg-black/15"
                            }`}
                          />
                          {!last ? (
                            <span
                              className={`mt-2 w-px flex-1 min-h-[3.5rem] ${
                                done ? "bg-black/25" : "bg-black/8"
                              }`}
                            />
                          ) : null}
                        </div>
                        <div className={last ? "pb-0" : "pb-10"}>
                          <p
                            className={`text-[15px] tracking-tight ${
                              muted ? "text-black/30" : "text-black"
                            }`}
                          >
                            {step.label}
                          </p>
                          <p
                            className={`mt-1 text-[13px] ${
                              muted ? "text-black/25" : "text-black/40"
                            }`}
                          >
                            {step.detail(latest)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>

                <div className="mt-14 space-y-4 text-[14px] text-black/45">
                  <p>{latest.neighbourhood}</p>
                  <p className="leading-relaxed">
                    {latest.categories.join(" · ") || "No categories"}
                  </p>
                  <p>{latest.contactEmail}</p>
                  <p className="text-black/30">
                    Edits {latest.editCount || 0}/{CURATION_MAX_EDITS}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-4 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={handleClose}
            className="min-h-11 px-1 text-[13px] text-black/40 transition-colors hover:text-black"
          >
            Close
          </button>

          {loading ? null : !latest ? (
            onApply ? (
              <button
                type="button"
                onClick={() => {
                  handleClose();
                  setTimeout(onApply, 300);
                }}
                className="text-[13px] text-black underline underline-offset-[6px] decoration-black/25 transition-colors hover:decoration-black"
              >
                Start application
              </button>
            ) : (
              <Link
                href="/sell"
                onClick={handleClose}
                className="text-[13px] text-black underline underline-offset-[6px] decoration-black/25 transition-colors hover:decoration-black"
              >
                Apply to sell
              </Link>
            )
          ) : canEdit ? (
            <button
              type="button"
              onClick={() => setEditApp(latest)}
              className="text-[13px] text-black underline underline-offset-[6px] decoration-black/25 transition-colors hover:decoration-black"
            >
              Edit · {editsLeft} left
            </button>
          ) : latest.status === "pending" ? (
            <span className="text-[13px] text-black/30">Edit limit reached</span>
          ) : null}
        </footer>
      </div>

      <SellApplicationPanel
        isOpen={!!editApp}
        onClose={() => {
          setEditApp(null);
          void load(true);
        }}
        editApplication={editApp}
        onTrack={() => {
          setEditApp(null);
          void load(true);
        }}
      />
    </div>
  );

  return createPortal(content, document.body);
}

export function openSellApplicationTracker() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("kc:open-sell-tracker"));
}
