"use client";

/** Root content wrapper - bottom-nav clearance lives on Footer only to avoid double pad. */
export default function ShellMain({ children }: { children: React.ReactNode }) {
  return <main>{children}</main>;
}
