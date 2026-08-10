"use client";

import ConditionalHeader, {
  ConditionalFooter,
} from "@/components/ConditionalHeader";
import dynamic from "next/dynamic";
import ShellMain from "@/components/ShellMain";

const BottomNav = dynamic(() => import("@/components/BottomNav"), {
  ssr: false,
});

/** Storefront chrome — document scroll; bottom nav is position:fixed. */
export default function AppChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ConditionalHeader />
      <ShellMain>{children}</ShellMain>
      <ConditionalFooter />
      <BottomNav />
    </>
  );
}
