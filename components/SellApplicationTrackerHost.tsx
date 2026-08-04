"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SellApplicationTrackerPanel from "@/components/SellApplicationTrackerPanel";

/**
 * Global host so sell-application tracking can open as a popup
 * from notifications, account nav, or after submit.
 */
export default function SellApplicationTrackerHost() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("kc:open-sell-tracker", onOpen);
    return () => window.removeEventListener("kc:open-sell-tracker", onOpen);
  }, []);

  return (
    <SellApplicationTrackerPanel
      isOpen={open}
      onClose={() => setOpen(false)}
      onApply={() => {
        setOpen(false);
        router.push("/sell");
      }}
    />
  );
}
