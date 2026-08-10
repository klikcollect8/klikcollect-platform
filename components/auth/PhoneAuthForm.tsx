"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSignIn, useSignUp } from "@clerk/nextjs";

export type AuthModalMode = "sign-in" | "sign-up";
type Channel = "phone" | "email";

type PhoneAuthFormProps = {
  mode: AuthModalMode;
  redirectUrl?: string;
};

const fieldClass =
  "h-auto w-full border-0 border-b border-black/15 bg-transparent px-0 py-3.5 text-[16px] text-black outline-none placeholder:text-black/30 focus:border-black/50";
const labelClass =
  "text-[11px] font-medium uppercase tracking-[0.18em] text-black/35";
const btnClass =
  "mt-2 flex h-12 w-full items-center justify-center bg-black text-[12px] font-medium uppercase tracking-[0.14em] text-white transition-opacity hover:opacity-80 disabled:opacity-40";

function AppleLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden
      fill="currentColor"
    >
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"
      />
    </svg>
  );
}

function MicrosoftLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path fill="#F25022" d="M2 2h9.5v9.5H2V2Z" />
      <path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5V2Z" />
      <path fill="#00A4EF" d="M2 12.5h9.5V22H2v-9.5Z" />
      <path fill="#FFB900" d="M12.5 12.5H22V22h-9.5v-9.5Z" />
    </svg>
  );
}

const SOCIAL = [
  {
    strategy: "oauth_apple" as const,
    label: "Apple",
    Icon: AppleLogo,
  },
  {
    strategy: "oauth_google" as const,
    label: "Google",
    Icon: GoogleLogo,
  },
  {
    strategy: "oauth_microsoft" as const,
    label: "Microsoft",
    Icon: MicrosoftLogo,
  },
];

function toE164(raw: string): string {
  const trimmed = raw.trim().replace(/[\s()-]/g, "");
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) return trimmed;
  if (trimmed.startsWith("254")) return `+${trimmed}`;
  if (trimmed.startsWith("0")) return `+254${trimmed.slice(1)}`;
  return `+254${trimmed}`;
}

function errorMessage(err: unknown): string {
  if (!err || typeof err !== "object") return "";
  const e = err as {
    message?: string;
    errors?: Array<{ message?: string; longMessage?: string }>;
    fields?: Record<string, { message?: string } | undefined>;
    global?: Array<{ message?: string }>;
  };
  return (
    e.fields?.identifier?.message ||
    e.fields?.phone_number?.message ||
    e.fields?.email_address?.message ||
    e.fields?.code?.message ||
    e.global?.[0]?.message ||
    e.errors?.[0]?.longMessage ||
    e.errors?.[0]?.message ||
    e.message ||
    ""
  );
}

export default function PhoneAuthForm({
  mode,
  redirectUrl = "/",
}: PhoneAuthFormProps) {
  const router = useRouter();
  const {
    signIn,
    errors: signInErrors,
    fetchStatus: signInStatus,
  } = useSignIn();
  const {
    signUp,
    errors: signUpErrors,
    fetchStatus: signUpStatus,
  } = useSignUp();

  const [channel, setChannel] = useState<Channel>("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pendingCode, setPendingCode] = useState(false);
  const [activeFlow, setActiveFlow] = useState<"sign-in" | "sign-up">(mode);
  const [localError, setLocalError] = useState<string | null>(null);

  const busy = signInStatus === "fetching" || signUpStatus === "fetching";
  const afterAuth = redirectUrl.startsWith("/") ? redirectUrl : "/";

  const fieldError = useMemo(
    () =>
      localError ||
      errorMessage(signInErrors) ||
      errorMessage(signUpErrors) ||
      null,
    [localError, signInErrors, signUpErrors],
  );

  const navigateAfter = (decorateUrl: (path: string) => string) => {
    const url = decorateUrl(afterAuth);
    if (url.startsWith("http")) window.location.href = url;
    else router.push(url);
  };

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    try {
      if (mode === "sign-up" || channel === "phone") {
        // Sign-up always collects phone; sign-in phone channel uses phone OTP
      }

      if (channel === "phone") {
        const phoneNumber = toE164(phone);
        if (phoneNumber.replace(/\D/g, "").length < 10) {
          setLocalError("Enter a valid phone number");
          return;
        }

        if (mode === "sign-in") {
          const { error } = await signIn.create({
            identifier: phoneNumber,
            signUpIfMissing: true,
          });
          if (error) {
            setLocalError(errorMessage(error));
            return;
          }

          // If Clerk transferred to sign-up, finish via signUp
          if (signUp.status && signUp.status !== "complete") {
            const sent = await signUp.verifications.sendPhoneCode();
            if (sent.error) {
              setLocalError(errorMessage(sent.error));
              return;
            }
            setActiveFlow("sign-up");
          } else {
            const sent = await signIn.phoneCode.sendCode({ phoneNumber });
            if (sent.error) {
              // Try sign-up path if identifier was transferred
              const up = await signUp.verifications.sendPhoneCode();
              if (up.error) {
                setLocalError(
                  errorMessage(sent.error) || errorMessage(up.error),
                );
                return;
              }
              setActiveFlow("sign-up");
            } else {
              setActiveFlow("sign-in");
            }
          }
        } else {
          const { error } = await signUp.create({
            phoneNumber,
            ...(email.trim() ? { emailAddress: email.trim() } : {}),
          });
          if (error) {
            setLocalError(errorMessage(error));
            return;
          }
          const sent = await signUp.verifications.sendPhoneCode();
          if (sent.error) {
            setLocalError(errorMessage(sent.error));
            return;
          }
          setActiveFlow("sign-up");
        }
      } else {
        const emailAddress = email.trim();
        if (!emailAddress.includes("@")) {
          setLocalError("Enter a valid email");
          return;
        }

        const { error } = await signIn.create({
          identifier: emailAddress,
          signUpIfMissing: true,
        });
        if (error) {
          setLocalError(errorMessage(error));
          return;
        }
        const sent = await signIn.emailCode.sendCode({ emailAddress });
        if (sent.error) {
          setLocalError(errorMessage(sent.error));
          return;
        }
        setActiveFlow("sign-in");
      }

      setPendingCode(true);
    } catch (err) {
      setLocalError(errorMessage(err) || "Could not send code");
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const otp = code.trim();
    if (!otp) {
      setLocalError("Enter the code we sent you");
      return;
    }

    try {
      if (activeFlow === "sign-up") {
        const { error } = await signUp.verifications.verifyPhoneCode({
          code: otp,
        });
        if (error) {
          setLocalError(errorMessage(error));
          return;
        }
        if (signUp.status === "complete") {
          await signUp.finalize({
            navigate: ({ session, decorateUrl }) => {
              if (session?.currentTask) return;
              navigateAfter(decorateUrl);
            },
          });
        }
        return;
      }

      if (channel === "email") {
        const { error } = await signIn.emailCode.verifyCode({ code: otp });
        if (error) {
          setLocalError(errorMessage(error));
          return;
        }
      } else {
        const { error } = await signIn.phoneCode.verifyCode({ code: otp });
        if (error) {
          // Might be a sign-up verification
          const up = await signUp.verifications.verifyPhoneCode({ code: otp });
          if (up.error) {
            setLocalError(errorMessage(error) || errorMessage(up.error));
            return;
          }
          if (signUp.status === "complete") {
            await signUp.finalize({
              navigate: ({ session, decorateUrl }) => {
                if (session?.currentTask) return;
                navigateAfter(decorateUrl);
              },
            });
            return;
          }
        }
      }

      if (signIn.status === "complete") {
        await signIn.finalize({
          navigate: ({ session, decorateUrl }) => {
            if (session?.currentTask) return;
            navigateAfter(decorateUrl);
          },
        });
      }
    } catch (err) {
      setLocalError(errorMessage(err) || "Invalid code");
    }
  };

  const oauth = async (
    strategy: "oauth_google" | "oauth_apple" | "oauth_microsoft",
  ) => {
    setLocalError(null);
    if (!signIn) {
      setLocalError("Auth is still loading. Try again in a moment.");
      return;
    }
    try {
      // Persist intent so /sso-callback can restore destination after transfer flows.
      const { persistAuthRedirect } = await import("@/lib/auth/return-path");
      persistAuthRedirect(afterAuth);
      // redirectUrl = destination when session is created
      // redirectCallbackUrl = /sso-callback when Clerk needs transfer / finalize
      const { error } = await signIn.sso({
        strategy,
        redirectUrl: afterAuth,
        redirectCallbackUrl: "/sso-callback",
      });
      if (error) setLocalError(errorMessage(error) || "Social sign-in failed");
    } catch (err) {
      setLocalError(errorMessage(err) || "Social sign-in failed");
    }
  };

  const resend = async () => {
    setLocalError(null);
    try {
      if (activeFlow === "sign-up") {
        await signUp.verifications.sendPhoneCode();
        return;
      }
      if (channel === "email") {
        await signIn.emailCode.sendCode({ emailAddress: email.trim() });
      } else {
        await signIn.phoneCode.sendCode({ phoneNumber: toE164(phone) });
      }
    } catch (err) {
      setLocalError(errorMessage(err) || "Could not resend code");
    }
  };

  if (pendingCode) {
    return (
      <form onSubmit={verifyCode} className="w-full space-y-5 text-left">
        <div>
          <label className={`${labelClass} mb-2 block`} htmlFor="kc-otp">
            Code
          </label>
          <input
            id="kc-otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-digit code"
            className={fieldClass}
          />
        </div>
        {fieldError ? (
          <p className="text-[13px] text-black/55">{fieldError}</p>
        ) : null}
        <button type="submit" className={btnClass} disabled={busy}>
          {busy ? "…" : "Verify"}
        </button>
        <div className="flex items-center justify-between text-[13px]">
          <button
            type="button"
            onClick={() => void resend()}
            className="text-black/40 underline decoration-black/20 underline-offset-[5px] hover:text-black"
          >
            Resend code
          </button>
          <button
            type="button"
            onClick={() => {
              setPendingCode(false);
              setCode("");
              setLocalError(null);
              void signIn.reset();
              void signUp.reset();
            }}
            className="text-black/40 hover:text-black"
          >
            Back
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="w-full text-left">
      {/* Required for Clerk bot protection on custom sign-up / OAuth transfer */}
      <div id="clerk-captcha" className="empty:hidden" />

      <div className="mb-6 flex gap-3">
        {SOCIAL.map(({ strategy, label, Icon }) => (
          <button
            key={strategy}
            type="button"
            onClick={() => void oauth(strategy)}
            disabled={busy || !signIn}
            className="flex h-12 flex-1 items-center justify-center border border-black/12 text-black transition-colors hover:border-black/40 disabled:opacity-40"
            aria-label={`Continue with ${label}`}
          >
            <Icon className="h-[18px] w-[18px]" />
          </button>
        ))}
      </div>

      <div className="mb-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-black/[0.08]" />
        <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-black/30">
          Or
        </span>
        <div className="h-px flex-1 bg-black/[0.08]" />
      </div>

      <form onSubmit={(e) => void sendCode(e)} className="space-y-5">
        {(channel === "phone" || mode === "sign-up") && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className={labelClass} htmlFor="kc-phone">
                Phone number
              </label>
              {mode === "sign-in" ? (
                <button
                  type="button"
                  onClick={() => {
                    setChannel("email");
                    setLocalError(null);
                  }}
                  className="text-[12px] text-black/40 hover:text-black"
                >
                  Use email
                </button>
              ) : null}
            </div>
            <input
              id="kc-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+254 7XX XXX XXX"
              className={fieldClass}
              required
            />
          </div>
        )}

        {(channel === "email" || mode === "sign-up") && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className={labelClass} htmlFor="kc-email">
                Email{mode === "sign-up" ? " · optional" : ""}
              </label>
              {mode === "sign-in" && channel === "email" ? (
                <button
                  type="button"
                  onClick={() => {
                    setChannel("phone");
                    setLocalError(null);
                  }}
                  className="text-[12px] text-black/40 hover:text-black"
                >
                  Use phone
                </button>
              ) : null}
            </div>
            <input
              id="kc-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={fieldClass}
              required={channel === "email" && mode === "sign-in"}
            />
          </div>
        )}

        {fieldError ? (
          <p className="text-[13px] text-black/55">{fieldError}</p>
        ) : null}

        <button type="submit" className={btnClass} disabled={busy}>
          {busy ? "…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
