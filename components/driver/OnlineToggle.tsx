"use client";

import { Power } from "lucide-react";

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
      className={`group flex items-center gap-2.5 rounded-full py-2 pl-2 pr-4 text-[13px] font-semibold tracking-tight shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition active:scale-[0.98] disabled:opacity-50 ${
        online
          ? "bg-[#111] text-white"
          : "bg-white/95 text-[#111] ring-1 ring-black/8 backdrop-blur"
      }`}
      aria-pressed={online}
    >
      <span
        className={`relative flex h-9 w-9 items-center justify-center rounded-full transition ${
          online
            ? "bg-emerald-400 text-[#062816]"
            : "bg-black/[0.06] text-black/50"
        }`}
      >
        {online ? (
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/40" />
        ) : null}
        <Power className="relative h-4 w-4" strokeWidth={2.5} />
      </span>
      {online ? "Online" : "Go online"}
    </button>
  );
}
