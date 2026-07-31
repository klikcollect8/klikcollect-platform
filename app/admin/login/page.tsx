"use client";

import Link from "next/link";
import { Show, SignInButton } from "@clerk/nextjs";
import { ui } from "@/components/system/tokens";

export default function AdminLogin() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f7f7f5] px-8 py-16">
      <div className="w-full max-w-sm text-center">
        <p className={ui.pageEyebrow}>Admin</p>
        <h1
          className={`mt-2 ${ui.pageTitle}`}
          style={{ fontFamily: "var(--font-display), sans-serif" }}
        >
          klikcollect
        </h1>
        <p className={`mt-2 ${ui.pageDesc}`}>Sign in to continue.</p>

        <div className="mt-10">
          <Show
            when="signed-out"
            fallback={
              <Link href="/admin" className={ui.btnPrimary}>
                Open admin
              </Link>
            }
          >
            <SignInButton mode="modal" forceRedirectUrl="/admin">
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
