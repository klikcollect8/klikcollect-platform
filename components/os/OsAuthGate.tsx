"use client";

import { Show } from "@clerk/nextjs";
import AuthModalTrigger from "@/components/auth/AuthModalTrigger";

export function OsAuthGate({
  children,
  title = "Sign in required",
  description = "Use the same Clerk account as the admin panel.",
}: {
  children: React.ReactNode;
  title?: string;
  description?: string;
}) {
  return (
    <>
      <Show when="signed-out">
        <div className="border border-[#1c1b19]/10 bg-[#f7f7f5] px-6 py-14 text-center">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#1c1b19]/35">
            Account
          </p>
          <h3 className="mt-3 text-[1.35rem] font-medium tracking-[-0.02em] text-[#1c1b19]">
            {title}
          </h3>
          <p className="mx-auto mt-3 max-w-md text-[14px] leading-relaxed text-[#1c1b19]/45">
            {description}
          </p>
          <div className="mt-7">
            <AuthModalTrigger
              redirect="/app"
              className="h-11 bg-[#1c1b19] px-6 text-[11px] font-medium uppercase tracking-[0.18em] text-[#f7f7f5] transition-opacity hover:opacity-85"
            >
              Sign in
            </AuthModalTrigger>
          </div>
        </div>
      </Show>
      <Show when="signed-in">{children}</Show>
    </>
  );
}
