"use client";

/** Root content wrapper. Mobile tab clearance is handled by the docked shell. */
export default function ShellMain({ children }: { children: React.ReactNode }) {
  return <main>{children}</main>;
}
