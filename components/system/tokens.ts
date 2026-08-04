/**
 * Shared Account / Vendor OS / Admin design tokens.
 * Obscura marketplace: warm canvas, black ink, seamless surfaces.
 */
export const tokens = {
  canvas: "#f7f7f5",
  surface: "#ffffff",
  border: "#e6e6e2",
  hairline: "#ecece8",
  text: "#0a0a0a",
  muted: "#3a3a3a",
  subtle: "#7a7a7a",
  primary: "#0a0a0a",
  primaryHover: "#000000",
  blue: "#0a0a0a",
  blueHover: "#000000",
  link: "#0a0a0a",
  successBg: "#e8f8ee",
  successText: "#248a3d",
  warnBg: "#fff4e5",
  warnText: "#bf4800",
  dangerBg: "#fcebea",
  dangerText: "#8e1b0d",
  radius: "0px",
  radiusSm: "0px",
  radiusPill: "0px",
} as const;

/** Tailwind-ready class snippets for consistent chrome. */
export const ui = {
  canvas: "bg-[var(--kc-canvas)]",
  surface: "bg-[var(--kc-stage)]",
  /** Seamless - no card borders */
  panel: "bg-transparent",
  btnPrimary:
    "inline-flex items-center justify-center bg-black px-5 py-3 text-[12px] font-medium uppercase tracking-[0.14em] text-white transition-opacity hover:opacity-80",
  btnSecondary:
    "inline-flex items-center justify-center border border-black/20 px-5 py-3 text-[12px] font-medium uppercase tracking-[0.14em] text-black transition-colors hover:border-black hover:bg-black hover:text-white",
  btnDark:
    "inline-flex items-center justify-center bg-black px-5 py-3 text-[12px] font-medium uppercase tracking-[0.14em] text-white transition-opacity hover:opacity-80",
  input:
    "border-b border-black/15 bg-transparent px-0 py-3 text-[15px] outline-none transition-colors placeholder:text-black/35 focus:border-black/50",
  pageTitle:
    "text-[28px] font-medium leading-tight tracking-tight text-black sm:text-[32px]",
  pageDesc: "text-[15px] leading-relaxed text-black/45",
  pageEyebrow:
    "text-[11px] font-medium uppercase tracking-[0.2em] text-black/35",
  navActive: "font-medium text-black",
  navIdle: "font-medium text-black/40 transition-colors hover:text-black",
  /** Full-bleed main - spans the page beside the sidebar */
  shellMain:
    "w-full max-w-none px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12 xl:px-16",
  shellAside: "w-[240px]",
  /** Admin main pad - overridden by --admin-aside when sidebar collapses */
  shellAsidePad: "lg:pl-[var(--admin-aside,240px)]",
} as const;
