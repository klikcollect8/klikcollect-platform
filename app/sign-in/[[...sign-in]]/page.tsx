"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { queueAuthModal } from "@/components/SignInModalProvider";

/** Bridge - opens the auth overlay instead of a dedicated page. */
export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const notice = searchParams.get("notice")?.trim() || null;
    const redirect = searchParams.get("redirect")?.trim() || "/";
    const target =
      redirect.startsWith("/") &&
      !redirect.startsWith("/sign-in") &&
      !redirect.startsWith("/sign-up")
        ? redirect
        : "/";

    const intent = {
      mode: "sign-in" as const,
      message: notice,
      redirect: target,
    };
    queueAuthModal(intent);
    window.dispatchEvent(new CustomEvent("openAuthModal", { detail: intent }));
    router.replace(target);
  }, [router, searchParams]);

  return (
    <div className="flex min-h-[100svh] items-center justify-center bg-[#f7f7f5]">
      <p className="text-[12px] uppercase tracking-[0.18em] text-black/35">
        Opening…
      </p>
    </div>
  );
}
