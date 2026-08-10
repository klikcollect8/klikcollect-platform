"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SignIn, useAuth, useClerk } from "@clerk/nextjs";
import { adminUi } from "@/components/admin/admin-ui";
import ClerkErrorBoundary from "@/components/admin/ClerkErrorBoundary";
import { clerkAppearance } from "@/lib/clerk-appearance";

type GateState =
  | "loading"
  | "signed_out"
  | "checking_access"
  | "allowed"
  | "denied"
  | "session_error";

function safeAdminReturn(raw: string | null): string {
  if (!raw) return "/admin";
  try {
    const path = decodeURIComponent(raw).trim();
    if (!path.startsWith("/admin")) return "/admin";
    if (path.startsWith("/admin/login")) return "/admin";
    if (path.includes("//") || path.includes("\\")) return "/admin";
    return path;
  } catch {
    return "/admin";
  }
}

export default function AdminLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { signOut } = useClerk();

  const returnTo = useMemo(
    () =>
      safeAdminReturn(
        searchParams.get("redirect") || searchParams.get("redirect_url"),
      ),
    [searchParams],
  );

  const [gate, setGate] = useState<GateState>("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const deniedHint = searchParams.get("denied") === "1";

  const verifyAccess = useCallback(async () => {
    setGate("checking_access");
    try {
      // Probe the session; stale Clerk sessions fail here instead of on every page.
      const token = await getToken();
      if (!token) {
        setGate("session_error");
        return;
      }

      const res = await fetch("/api/admin/current-role", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = (await res.json()) as {
        authenticated?: boolean;
        isAdmin?: boolean;
        role?: string | null;
        user?: { email?: string | null };
        error?: string;
      };

      if (!data.authenticated) {
        setGate("session_error");
        return;
      }

      setEmail(data.user?.email ?? null);

      if (data.isAdmin || data.role) {
        setGate("allowed");
        router.replace(returnTo);
        return;
      }

      setGate("denied");
    } catch {
      setGate(deniedHint ? "denied" : "session_error");
    }
  }, [deniedHint, getToken, returnTo, router]);

  useEffect(() => {
    if (!isLoaded) {
      setGate("loading");
      return;
    }
    if (!isSignedIn) {
      setGate("signed_out");
      return;
    }
    void verifyAccess();
  }, [isLoaded, isSignedIn, verifyAccess]);

  const resetSession = useCallback(async () => {
    setBusy(true);
    try {
      await signOut({ redirectUrl: `/admin/login?redirect=${encodeURIComponent(returnTo)}` });
    } catch {
      window.location.href = `/admin/login?redirect=${encodeURIComponent(returnTo)}`;
    } finally {
      setBusy(false);
    }
  }, [returnTo, signOut]);

  return (
    <div className="relative min-h-[100svh] overflow-hidden bg-[var(--kc-canvas,#f7f7f5)] text-black">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(80% 55% at 12% -10%, rgba(12,12,12,0.06) 0%, transparent 55%), radial-gradient(70% 50% at 100% 100%, rgba(12,12,12,0.05) 0%, transparent 50%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-[12%] hidden w-px bg-black/[0.06] lg:block"
      />

      <div className="relative mx-auto grid min-h-[100svh] w-full max-w-[1100px] grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="flex flex-col justify-between px-6 py-8 sm:px-10 sm:py-12 lg:px-14 lg:py-16">
          <div>
            <Link
              href="/"
              className="text-[11px] font-medium uppercase tracking-[0.2em] text-black/40 transition-colors hover:text-black"
            >
              ← Storefront
            </Link>
            <p className={`mt-14 ${adminUi.pageEyebrow}`}>Platform admin</p>
            <h1
              className="mt-3 max-w-[12ch] text-[clamp(2.4rem,6vw,4.2rem)] font-medium leading-[0.95] tracking-tight text-black"
              style={{ fontFamily: "var(--font-display), sans-serif" }}
            >
              KlikCollect
            </h1>
            <p className={`mt-5 max-w-sm ${adminUi.pageDesc}`}>
              Sign in with a platform staff account to manage catalogue,
              orders, vendors, and system controls.
            </p>
          </div>

          <p className="mt-16 hidden text-[12px] text-black/35 lg:block">
            Authorized staff only · Nairobi · KES
          </p>
        </section>

        <section className="flex items-center px-6 pb-12 sm:px-10 lg:px-12 lg:py-16">
          <div className="w-full max-w-[420px] border border-black/10 bg-[var(--kc-canvas,#f7f7f5)]/90 px-6 py-8 backdrop-blur-md sm:px-8 sm:py-10">
            {gate === "loading" || gate === "checking_access" ? (
              <div className="space-y-3 py-10 text-center">
                <p className={adminUi.pageEyebrow}>
                  {gate === "checking_access" ? "Checking access" : "Loading"}
                </p>
                <p className="text-[14px] text-black/45">One moment…</p>
              </div>
            ) : null}

            {gate === "signed_out" ? (
              <div>
                <p className={adminUi.pageEyebrow}>Sign in</p>
                <h2 className="mt-2 text-[22px] font-medium tracking-tight text-black">
                  Continue to admin
                </h2>
                <p className="mt-2 text-[14px] leading-relaxed text-black/45">
                  Use your staff email or connected provider.
                </p>
                <div className="mt-8">
                  <ClerkErrorBoundary>
                    <SignIn
                      routing="hash"
                      forceRedirectUrl={returnTo}
                      fallbackRedirectUrl={returnTo}
                      signUpUrl="/sign-up"
                      appearance={clerkAppearance}
                    />
                  </ClerkErrorBoundary>
                </div>
              </div>
            ) : null}

            {gate === "allowed" ? (
              <div className="space-y-6 text-center">
                <p className={adminUi.pageEyebrow}>Access confirmed</p>
                <h2 className="text-[22px] font-medium tracking-tight text-black">
                  Opening admin…
                </h2>
                <Link href={returnTo} className={`${adminUi.btnPrimary} w-full`}>
                  Continue
                </Link>
              </div>
            ) : null}

            {gate === "denied" ? (
              <div className="space-y-6">
                <p className={adminUi.pageEyebrow}>No admin access</p>
                <h2 className="text-[22px] font-medium tracking-tight text-black">
                  This account isn’t staff
                </h2>
                <p className="text-[14px] leading-relaxed text-black/45">
                  {email
                    ? `${email} is signed in, but it doesn’t have a platform role.`
                    : "You’re signed in, but this account doesn’t have a platform role."}{" "}
                  Ask a super admin to grant access, or switch accounts.
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void resetSession()}
                    className={`${adminUi.btnPrimary} w-full`}
                  >
                    {busy ? "Signing out…" : "Sign out & try another account"}
                  </button>
                  <Link href="/" className={`${adminUi.btnSecondary} w-full`}>
                    Back to storefront
                  </Link>
                </div>
              </div>
            ) : null}

            {gate === "session_error" ? (
              <div className="space-y-6">
                <p className={adminUi.pageEyebrow}>Session problem</p>
                <h2 className="text-[22px] font-medium tracking-tight text-black">
                  Clerk couldn’t refresh your session
                </h2>
                <p className="text-[14px] leading-relaxed text-black/45">
                  This usually means a stale login cookie or a blocked network
                  request to Clerk. Reset the session and sign in again.
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void resetSession()}
                    className={`${adminUi.btnPrimary} w-full`}
                  >
                    {busy ? "Resetting…" : "Reset session & sign in"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void verifyAccess()}
                    className={`${adminUi.btnSecondary} w-full`}
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
