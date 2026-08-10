import { Suspense } from "react";

export default function AdminLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100svh] items-center justify-center bg-[var(--kc-canvas,#f7f7f5)]">
          <p className="text-[12px] uppercase tracking-[0.18em] text-black/35">
            Loading…
          </p>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
