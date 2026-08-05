"use client";

import dynamic from "next/dynamic";

const CommerceMapPage = dynamic(
  () => import("@/components/maps/CommerceMapPage"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[calc(100vh-5rem)] w-full items-center justify-center bg-[#e8eaed]">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-black/40">
          Loading map
        </p>
      </div>
    ),
  },
);

export default function CommerceMapLazy() {
  return <CommerceMapPage />;
}
