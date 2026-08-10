"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { queueAuthModal } from "@/components/SignInModalProvider";
import {
  publicLandingForAuth,
  resolveAuthReturnPath,
} from "@/lib/auth/return-path";

/** Bridge - opens the auth overlay instead of a dedicated page. */
export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const notice = searchParams.get("notice")?.trim() || null;
    const target = resolveAuthReturnPath(searchParams);
    const landing = publicLandingForAuth(target);

    const intent = {
      mode: "sign-in" as const,
      message: notice,
      redirect: target,
    };
    queueAuthModal(intent);
    window.dispatchEvent(new CustomEvent("openAuthModal", { detail: intent }));
    // Never bounce into protected routes while still signed out (breaks checkout loop).
    router.replace(landing);
  }, [router, searchParams]);

  return (
    <div className="flex min-h-[100svh] items-center justify-center bg-[#f7f7f5]">
      <p className="text-[12px] uppercase tracking-[0.18em] text-black/35">
        Opening…
      </p>
    </div>
  );
}
