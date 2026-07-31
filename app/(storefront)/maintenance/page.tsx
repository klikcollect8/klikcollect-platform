"use client";

import { useEffect, useState } from "react";

export default function MaintenancePage() {
  const [siteName, setSiteName] = useState("KlikCollect");

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.siteName) setSiteName(data.siteName);
      })
      .catch(() => {
        /* default */
      });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f7f5] px-6">
      <div className="max-w-md text-center">
        <p className="mb-4 text-[12px] font-medium uppercase tracking-[0.24em] text-black/40">
          {siteName}
        </p>
        <h1 className="text-[clamp(2rem,4vw,2.75rem)] font-medium tracking-tight">
          We’ll be back soon
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed text-black/50">
          We’re performing maintenance. Please check back shortly.
        </p>
      </div>
    </div>
  );
}
