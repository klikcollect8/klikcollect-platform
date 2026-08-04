/**
 * OS design tokens - fusion of Apple stage, Amazon density, eBay trust.
 * Prefer CSS vars from globals.css (`--kc-*`); these mirror for TS consumers.
 */
export const os = {
  canvas: "bg-[var(--kc-canvas)]",
  surface: "bg-[var(--kc-stage)]",
  border: "border-[var(--kc-line)]",
  text: "text-[var(--kc-ink)]",
  muted: "text-[var(--kc-mute)]",
  subtle: "text-[var(--kc-faint)]",
  hairline: "border-[var(--kc-line-soft)]",
  radius: "rounded-[var(--kc-radius)]",
  radiusSm: "rounded-[var(--kc-radius-sm)]",
  focus:
    "focus:border-[var(--kc-blue)] focus:outline-none focus:shadow-[0_0_0_3px_rgba(0,113,227,0.15)]",
} as const;
