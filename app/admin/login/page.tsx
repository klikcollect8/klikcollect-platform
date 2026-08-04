"use client";

import Link from "next/link";
import { Show, SignInButton } from "@clerk/nextjs";
import { ui } from "@/components/system/tokens";

export default function AdminLogin() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#f7f7f5] px-8 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(90% 70% at 50% 0%, rgba(232, 226, 214, 0.55) 0%, transparent 55%), linear-gradient(180deg, #f7f7f5 0%, #f3f1ec 100%)",
        }}
      />

      <div className="relative w-full max-w-sm border border-[#1c1b19]/10 bg-[#f7f7f5]/80 px-8 py-10 text-center backdrop-blur-[12px]">
        <p className={ui.pageEyebrow}>Admin</p>
        <h1
          className={`mt-2 ${ui.pageTitle}`}
          style={{ fontFamily: "var(--font-display), sans-serif" }}
        >
          KlikCollect
        </h1>
        <p className={`mt-3 ${ui.pageDesc}`}>Sign in to manage the hall.</p>

        <div className="mt-10">
          <Show
            when="signed-out"
            fallback={
              <Link href="/admin" className={`${ui.btnPrimary} w-full`}>
                Open admin
              </Link>
            }
          >
            <SignInButton mode="redirect" forceRedirectUrl="/admin">
              <button type="button" className={`w-full ${ui.btnPrimary}`}>
                Sign in
              </button>
            </SignInButton>
          </Show>
        </div>
      </div>
    </div>
  );
}
