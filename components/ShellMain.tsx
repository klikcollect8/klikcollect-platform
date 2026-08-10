"use client";

/** Root content wrapper — bottom padding is not needed when the docked shell owns the tab bar. */
export default function ShellMain({ children }: { children: React.ReactNode }) {
  return <main>{children}</main>;
}
