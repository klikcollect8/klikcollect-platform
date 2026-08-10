"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { queueAuthModal } from "@/components/SignInModalProvider";
import {
  publicLandingForAuth,
  resolveAuthReturnPath,
} from "@/lib/auth/return-path";

/** Bridge - opens the auth overlay instead of a dedicated page. */
export default function SignUpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const target = resolveAuthReturnPath(searchParams);
    const landing = publicLandingForAuth(target);

    const intent = {
      mode: "sign-up" as const,
      redirect: target,
    };
    queueAuthModal(intent);
    window.dispatchEvent(new CustomEvent("openAuthModal", { detail: intent }));
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
