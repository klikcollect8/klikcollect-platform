"use client";

import { cn } from "@/lib/utils";

export type ChoiceOption = { value: string; label: string; hint?: string };

type Props = {
  options: ChoiceOption[];
  value: string;
  onChange: (v: string) => void;
  otherValue?: string;
  onOtherChange?: (v: string) => void;
  otherPlaceholder?: string;
  /** Show custom text field when this value is selected (default: "other") */
  otherKey?: string;
};

/** Sell-application style choice rows with optional custom “Other” input. */
export default function CheckoutChoiceList({
  options,
  value,
  onChange,
  otherValue,
  onOtherChange,
  otherPlaceholder = "Type your own…",
  otherKey = "other",
}: Props) {
  return (
    <div className="mt-8 border-t border-black/[0.06]">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <div key={opt.value}>
            <button
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                "flex w-full min-h-14 items-center justify-between gap-4 border-b border-black/[0.06] py-4 text-left transition-opacity hover:opacity-70",
                active ? "text-black" : "text-black/50",
              )}
            >
              <span>
                <span className="block text-[15px] sm:text-[16px]">
                  {opt.label}
                </span>
                {opt.hint ? (
                  <span className="mt-1 block text-[12px] text-black/35">
                    {opt.hint}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 text-[11px] uppercase tracking-[0.14em] text-black/30">
                {active ? "Selected" : "Select"}
              </span>
            </button>
            {opt.value === otherKey && active && onOtherChange ? (
              <input
                value={otherValue || ""}
                onChange={(e) => onOtherChange(e.target.value)}
                placeholder={otherPlaceholder}
                className="w-full border-b border-black/15 bg-transparent py-4 text-[16px] outline-none focus:border-black/40"
                autoFocus
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
