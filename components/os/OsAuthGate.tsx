"use client";

import { Show, SignInButton } from "@clerk/nextjs";

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
        <div className="rounded-xl border border-neutral-200 bg-white px-6 py-12 text-center">
          <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">{description}</p>
          <div className="mt-5">
            <SignInButton mode="redirect">
              <button
                type="button"
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
              >
                Sign in
              </button>
            </SignInButton>
          </div>
        </div>
      </Show>
      <Show when="signed-in">{children}</Show>
    </>
  );
}
