"use client";

import { Power } from "lucide-react";
import { mapGlass } from "@/components/map/MapChrome";
import { cn } from "@/lib/utils";

type OnlineToggleProps = {
  online: boolean;
  busy?: boolean;
  onChange: (online: boolean) => void;
};

export default function OnlineToggle({
  online,
  busy,
  onChange,
}: OnlineToggleProps) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => onChange(!online)}
      className={cn(
        "group flex items-center gap-2.5 py-2 pl-2 pr-4 text-[12px] font-medium uppercase tracking-[0.12em] transition active:scale-[0.98] disabled:opacity-50",
        online ? "bg-black/85 text-white backdrop-blur-xl" : mapGlass,
      )}
      aria-pressed={online}
    >
      <span
        className={cn(
          "relative flex h-9 w-9 items-center justify-center transition",
          online ? "bg-emerald-400/90 text-[#062816]" : "bg-black/[0.06] text-black/45",
        )}
      >
        {online ? (
          <span className="absolute inset-0 animate-ping bg-emerald-400/35" />
        ) : null}
        <Power className="relative h-4 w-4" strokeWidth={2.25} />
      </span>
      <span className={online ? "text-white" : "text-black/70"}>
        {online ? "Online" : "Go online"}
      </span>
    </button>
  );
}
