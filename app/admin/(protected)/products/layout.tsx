import { Suspense } from "react";

export default function AdminProductsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Suspense fallback={<div className="p-10 text-black/35">Loading…</div>}>{children}</Suspense>;
}
