"use client";

import ConditionalHeader, {
  ConditionalFooter,
} from "@/components/ConditionalHeader";
import BottomNav from "@/components/BottomNav";
import ShellMain from "@/components/ShellMain";

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
