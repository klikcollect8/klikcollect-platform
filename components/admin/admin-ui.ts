/**
 * Admin chrome - same language as storefront homepage.
 * Seamless, full-bleed, warm canvas. Complexity in structure, not chrome.
 */
export const adminUi = {
  canvas: "bg-[var(--kc-canvas)]",
  surface: "bg-transparent",
  card: "bg-transparent",
  cardHover: "bg-transparent transition-opacity hover:opacity-70",
  primary: "#0a0a0a",
  primaryBg: "bg-black",
  primaryText: "text-black",
  btnPrimary:
    "inline-flex items-center justify-center gap-2 bg-black px-5 py-3 text-[12px] font-medium uppercase tracking-[0.14em] text-white transition-opacity hover:opacity-80 disabled:opacity-40",
  btnSecondary:
    "inline-flex items-center justify-center gap-2 border border-black/20 px-5 py-3 text-[12px] font-medium uppercase tracking-[0.14em] text-black transition-colors hover:border-black hover:bg-black hover:text-white disabled:opacity-40",
  btnGhost:
    "inline-flex items-center justify-center gap-2 px-3 py-2 text-[13px] font-medium text-black/50 transition-colors hover:text-black",
  input:
    "w-full border-b border-black/15 bg-transparent px-0 py-3 text-[15px] text-black outline-none transition-colors placeholder:text-black/35 focus:border-black/50",
  pageTitle:
    "text-[28px] font-medium leading-tight tracking-tight text-black sm:text-[34px]",
  pageDesc: "text-[15px] leading-relaxed text-black/45",
  pageEyebrow:
    "text-[11px] font-medium uppercase tracking-[0.2em] text-black/35",
  navActive: "font-medium text-black",
  navIdle: "font-medium text-black/40 transition-colors hover:text-black",
  shellAside: "w-[260px]",
  shellAsidePad: "lg:pl-[var(--admin-aside,260px)]",
  navActiveItem:
    "relative font-medium text-black before:absolute before:inset-y-2 before:left-0 before:w-[2px] before:bg-black",
  navIdleItem:
    "font-medium text-black/42 transition-colors hover:text-black",
  shellMain:
    "w-full max-w-none px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12 xl:px-16",
  badge:
    "inline-flex min-w-[18px] items-center justify-center text-[11px] font-medium tabular-nums text-black/40",
  sectionLabel:
    "text-[11px] font-medium uppercase tracking-[0.16em] text-black/35",
} as const;
