"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth, useClerk, useSignIn, useSignUp } from "@clerk/nextjs";
import ClerkCaptcha from "@/components/auth/ClerkCaptcha";

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

const CAPTCHA_HELP =
  "Security check failed. Turn off ad blockers for this site, refresh, then try again.";

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

/** Kenya mobiles: +254 7XXXXXXXX or +254 1XXXXXXXX */
const KENYA_MOBILE = /^\+254[17]\d{8}$/;

function toE164(raw: string): string {
  const trimmed = raw.trim().replace(/[\s()-]/g, "");
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) return trimmed;
  if (trimmed.startsWith("254")) return `+${trimmed}`;
  if (trimmed.startsWith("0")) return `+254${trimmed.slice(1)}`;
  return `+254${trimmed}`;
}

type ClerkishError = {
  code?: string;
  message?: string;
  longMessage?: string;
  errors?: Array<{ code?: string; message?: string; longMessage?: string }>;
  fields?: Record<string, { message?: string; code?: string } | undefined>;
  global?: Array<{ message?: string; code?: string }>;
};

function firstError(err: unknown): ClerkishError | null {
  if (!err || typeof err !== "object") return null;
  return err as ClerkishError;
}

function errorCode(err: unknown): string {
  const e = firstError(err);
  return (
    e?.errors?.[0]?.code ||
    e?.fields?.identifier?.code ||
    e?.fields?.phone_number?.code ||
    e?.global?.[0]?.code ||
    e?.code ||
    ""
  );
}

function errorMessage(err: unknown): string {
  const e = firstError(err);
  if (!e) return "";
  return (
    e.fields?.identifier?.message ||
    e.fields?.phone_number?.message ||
    e.fields?.email_address?.message ||
    e.fields?.code?.message ||
    e.global?.[0]?.message ||
    e.errors?.[0]?.longMessage ||
    e.errors?.[0]?.message ||
    e.longMessage ||
    e.message ||
    ""
  );
}

function isCaptchaError(err: unknown): boolean {
  const code = errorCode(err).toLowerCase();
  const msg = errorMessage(err).toLowerCase();
  return (
    code === "captcha_invalid" ||
    msg.includes("security validation") ||
    msg.includes("failed security")
  );
}

function isIdentifierExists(err: unknown): boolean {
  const code = errorCode(err).toLowerCase();
  return (
    code === "form_identifier_exists" ||
    code.includes("identifier_exists") ||
    errorMessage(err).toLowerCase().includes("already exists")
  );
}

function isIdentifierNotFound(err: unknown): boolean {
  const code = errorCode(err).toLowerCase();
  const msg = errorMessage(err).toLowerCase();
  return (
    code.includes("identifier_not_found") ||
    code.includes("not_found") ||
    msg.includes("couldn't find") ||
    msg.includes("could not find") ||
    msg.includes("doesn't exist") ||
    msg.includes("does not exist")
  );
}

function isSmsCountryError(err: unknown): boolean {
  const code = errorCode(err).toLowerCase();
  const msg = errorMessage(err).toLowerCase();
  return (
    code.includes("sms") ||
    code.includes("unsupported_country") ||
    code.includes("country_blocked") ||
    msg.includes("country") ||
    msg.includes("sms is not") ||
    msg.includes("cannot send") ||
    msg.includes("not enabled")
  );
}

function friendlyError(err: unknown): string {
  if (isCaptchaError(err)) return CAPTCHA_HELP;
  if (isSmsCountryError(err)) {
    return "Could not text that number. Use a Kenya mobile in +254 7… or +254 1… format.";
  }
  return errorMessage(err);
}

export default function PhoneAuthForm({
  mode,
  redirectUrl = "/",
}: PhoneAuthFormProps) {
  const clerk = useClerk();
  const { isSignedIn } = useAuth();
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
  const [needEmail, setNeedEmail] = useState(false);
  const [activeFlow, setActiveFlow] = useState<"sign-in" | "sign-up">(mode);
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loaded = clerk.loaded && !!signIn && !!signUp;
  const busy =
    submitting ||
    signInStatus === "fetching" ||
    signUpStatus === "fetching";
  const afterAuth = redirectUrl.startsWith("/") ? redirectUrl : "/";

  const fieldError = useMemo(() => {
    if (localError) return localError;
    const fromClerk = signInErrors || signUpErrors;
    if (fromClerk && isCaptchaError(fromClerk)) return CAPTCHA_HELP;
    return errorMessage(signInErrors) || errorMessage(signUpErrors) || null;
  }, [localError, signInErrors, signUpErrors]);

  const leaveToApp = (path: string) => {
    window.location.assign(path);
  };

  useEffect(() => {
    if (!isSignedIn || !pendingCode) return;
    leaveToApp(afterAuth);
  }, [isSignedIn, pendingCode, afterAuth]);

  const activateSession = async (sessionId: string) => {
    await clerk.setActive({ session: sessionId });
    leaveToApp(afterAuth);
  };

  const finishAuth = async (flow: "sign-in" | "sign-up"): Promise<boolean> => {
    const resource = flow === "sign-in" ? signIn : signUp;
    const sessionId =
      resource.createdSessionId || resource.existingSession?.sessionId || null;

    if (sessionId) {
      await activateSession(sessionId);
      return true;
    }

    if (resource.status !== "complete") return false;

    const { error } = await resource.finalize({
      navigate: ({ decorateUrl, session }) => {
        const id = session?.id || resource.createdSessionId;
        if (id) {
          void clerk.setActive({ session: id }).then(() => {
            leaveToApp(decorateUrl(afterAuth));
          });
          return;
        }
        leaveToApp(decorateUrl(afterAuth));
      },
    });

    if (error) {
      if (resource.createdSessionId) {
        await activateSession(resource.createdSessionId);
        return true;
      }
      setLocalError(friendlyError(error) || "Could not finish signing in");
      return false;
    }

    // Finalize reported success but navigate may have been a no-op.
    if (resource.createdSessionId) {
      await activateSession(resource.createdSessionId);
      return true;
    }
    leaveToApp(afterAuth);
    return true;
  };

  const continueIncompleteSignUp = async (): Promise<boolean> => {
    if (signUp.status === "complete") return finishAuth("sign-up");

    const missing = signUp.missingFields ?? [];
    const unverified = signUp.unverifiedFields ?? [];

    if (missing.includes("email_address") || unverified.includes("email_address")) {
      setNeedEmail(true);
      setLocalError("Add your email to finish creating the account.");
      return true;
    }

    if (missing.length === 0 && unverified.length === 0) {
      const { error } = await signUp.update({});
      if (error) {
        setLocalError(friendlyError(error) || "Could not finish sign-up");
        return false;
      }
      if (signUp.createdSessionId) return finishAuth("sign-up");
      if (await finishAuth("sign-up")) return true;
    }

    if (missing.length > 0) {
      setLocalError(`Additional info needed: ${missing.join(", ")}`);
      return false;
    }

    setLocalError("Could not finish sign-up. Try signing in instead.");
    return false;
  };

  const continueIncompleteSignIn = async (): Promise<boolean> => {
    if (signIn.status === "complete" || signIn.createdSessionId) {
      return finishAuth("sign-in");
    }

    if (
      signIn.status === "needs_second_factor" ||
      signIn.status === "needs_client_trust"
    ) {
      const phoneFactor = signIn.supportedSecondFactors?.find(
        (factor) => factor.strategy === "phone_code",
      );
      if (phoneFactor) {
        const sent = await signIn.mfa.sendPhoneCode();
        if (sent.error) {
          setLocalError(friendlyError(sent.error) || "Could not send second code");
          return false;
        }
        setCode("");
        setLocalError("Enter the second code we just sent to your phone.");
        return true;
      }
      setLocalError("Additional verification is required. Try again.");
      return false;
    }

    setLocalError("Could not finish sign-in. Check the code and try again.");
    return false;
  };

  const startPhoneSignIn = async (phoneNumber: string) => {
    const sent = await signIn.phoneCode.sendCode({
      phoneNumber,
      channel: "sms",
    });
    if (!sent.error) {
      setActiveFlow("sign-in");
      return null;
    }
    if (isCaptchaError(sent.error)) return sent.error;

    const created = await signUp.create({ phoneNumber });
    if (created.error) {
      if (isIdentifierExists(created.error)) return sent.error;
      return created.error;
    }
    const up = await signUp.verifications.sendPhoneCode({ channel: "sms" });
    if (up.error) return up.error || sent.error;
    setActiveFlow("sign-up");
    return null;
  };

  const startPhoneSignUp = async (phoneNumber: string) => {
    const created = await signUp.create({
      phoneNumber,
      ...(email.trim() ? { emailAddress: email.trim() } : {}),
    });
    if (created.error) {
      if (isCaptchaError(created.error)) return created.error;
      if (isIdentifierExists(created.error)) {
        return startPhoneSignIn(phoneNumber);
      }
      return created.error;
    }
    const sent = await signUp.verifications.sendPhoneCode({ channel: "sms" });
    if (sent.error) return sent.error;
    setActiveFlow("sign-up");
    return null;
  };

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!loaded) {
      setLocalError("Auth is still loading. Try again in a moment.");
      return;
    }

    setSubmitting(true);
    try {
      if (channel === "phone") {
        const phoneNumber = toE164(phone);
        if (phoneNumber.startsWith("+254") && !KENYA_MOBILE.test(phoneNumber)) {
          setLocalError("Enter a valid Kenya mobile, e.g. 07XX XXX XXX");
          return;
        }
        if (phoneNumber.replace(/\D/g, "").length < 10) {
          setLocalError("Enter a valid phone number");
          return;
        }

        const err =
          mode === "sign-in"
            ? await startPhoneSignIn(phoneNumber)
            : await startPhoneSignUp(phoneNumber);
        if (err) {
          setLocalError(friendlyError(err) || "Could not send code");
          return;
        }
      } else {
        const emailAddress = email.trim();
        if (!emailAddress.includes("@")) {
          setLocalError("Enter a valid email");
          return;
        }

        const sent = await signIn.emailCode.sendCode({ emailAddress });
        if (sent.error) {
          if (isIdentifierNotFound(sent.error)) {
            const created = await signUp.create({ emailAddress });
            if (created.error) {
              setLocalError(friendlyError(created.error) || "Could not send code");
              return;
            }
            const up = await signUp.verifications.sendEmailCode();
            if (up.error) {
              setLocalError(friendlyError(up.error) || "Could not send code");
              return;
            }
            setActiveFlow("sign-up");
          } else {
            setLocalError(friendlyError(sent.error) || "Could not send code");
            return;
          }
        } else {
          setActiveFlow("sign-in");
        }
      }

      setPendingCode(true);
    } catch (err) {
      setLocalError(friendlyError(err) || "Could not send code");
    } finally {
      setSubmitting(false);
    }
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const emailAddress = email.trim();
    if (!emailAddress.includes("@")) {
      setLocalError("Enter a valid email");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await signUp.update({ emailAddress });
      if (error) {
        setLocalError(friendlyError(error) || "Could not save email");
        return;
      }
      if (signUp.status === "complete" || signUp.createdSessionId) {
        await finishAuth("sign-up");
        return;
      }
      if (signUp.unverifiedFields?.includes("email_address")) {
        const sent = await signUp.verifications.sendEmailCode();
        if (sent.error) {
          setLocalError(friendlyError(sent.error) || "Could not send email code");
          return;
        }
        setChannel("email");
        setNeedEmail(false);
        setCode("");
        setPendingCode(true);
        setLocalError("Enter the code we emailed you.");
        return;
      }
      await continueIncompleteSignUp();
    } catch (err) {
      setLocalError(friendlyError(err) || "Could not save email");
    } finally {
      setSubmitting(false);
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

    setSubmitting(true);
    try {
      if (activeFlow === "sign-up") {
        const verify =
          channel === "email"
            ? await signUp.verifications.verifyEmailCode({ code: otp })
            : await signUp.verifications.verifyPhoneCode({ code: otp });
        if (verify.error) {
          setLocalError(errorMessage(verify.error) || "Invalid code");
          return;
        }
        if (signUp.status === "complete" || signUp.createdSessionId) {
          await finishAuth("sign-up");
          return;
        }
        await continueIncompleteSignUp();
        return;
      }

      if (signIn.status === "needs_second_factor" || signIn.status === "needs_client_trust") {
        const mfa = await signIn.mfa.verifyPhoneCode({ code: otp });
        if (mfa.error) {
          setLocalError(errorMessage(mfa.error) || "Invalid code");
          return;
        }
        await continueIncompleteSignIn();
        return;
      }

      if (channel === "email") {
        const { error } = await signIn.emailCode.verifyCode({ code: otp });
        if (error) {
          setLocalError(errorMessage(error) || "Invalid code");
          return;
        }
      } else {
        const { error } = await signIn.phoneCode.verifyCode({ code: otp });
        if (error) {
          const up = await signUp.verifications.verifyPhoneCode({ code: otp });
          if (!up.error) {
            setActiveFlow("sign-up");
            if (signUp.status === "complete" || signUp.createdSessionId) {
              await finishAuth("sign-up");
              return;
            }
            await continueIncompleteSignUp();
            return;
          }
          setLocalError(errorMessage(error) || errorMessage(up.error) || "Invalid code");
          return;
        }
      }

      await continueIncompleteSignIn();
    } catch (err) {
      setLocalError(errorMessage(err) || "Invalid code");
    } finally {
      setSubmitting(false);
    }
  };

  const oauth = async (
    strategy: "oauth_google" | "oauth_apple" | "oauth_microsoft",
  ) => {
    setLocalError(null);
    if (!signIn || !clerk.loaded) {
      setLocalError("Auth is still loading. Try again in a moment.");
      return;
    }
    try {
      const { persistAuthRedirect } = await import("@/lib/auth/return-path");
      persistAuthRedirect(afterAuth);
      const { error } = await signIn.sso({
        strategy,
        redirectUrl: afterAuth,
        redirectCallbackUrl: "/sso-callback",
      });
      if (error) setLocalError(friendlyError(error) || "Social sign-in failed");
    } catch (err) {
      setLocalError(friendlyError(err) || "Social sign-in failed");
    }
  };

  const resend = async () => {
    setLocalError(null);
    setSubmitting(true);
    try {
      if (activeFlow === "sign-up") {
        const sent =
          channel === "email"
            ? await signUp.verifications.sendEmailCode()
            : await signUp.verifications.sendPhoneCode({ channel: "sms" });
        if (sent.error) {
          setLocalError(friendlyError(sent.error) || "Could not resend code");
        }
        return;
      }
      if (channel === "email") {
        const sent = await signIn.emailCode.sendCode({
          emailAddress: email.trim(),
        });
        if (sent.error) {
          setLocalError(friendlyError(sent.error) || "Could not resend code");
        }
        return;
      }
      if (signIn.status === "needs_second_factor" || signIn.status === "needs_client_trust") {
        const sent = await signIn.mfa.sendPhoneCode();
        if (sent.error) {
          setLocalError(friendlyError(sent.error) || "Could not resend code");
        }
        return;
      }
      const sent = await signIn.phoneCode.sendCode({
        phoneNumber: toE164(phone),
        channel: "sms",
      });
      if (sent.error) {
        setLocalError(friendlyError(sent.error) || "Could not resend code");
      }
    } catch (err) {
      setLocalError(errorMessage(err) || "Could not resend code");
    } finally {
      setSubmitting(false);
    }
  };

  if (needEmail) {
    return (
      <form onSubmit={(e) => void submitEmail(e)} className="w-full space-y-5 text-left">
        <ClerkCaptcha />
        <div>
          <label className={`${labelClass} mb-2 block`} htmlFor="kc-email-finish">
            Email
          </label>
          <input
            id="kc-email-finish"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={fieldClass}
            required
          />
        </div>
        {fieldError ? (
          <p className="text-[13px] text-black/55">{fieldError}</p>
        ) : (
          <p className="text-[13px] text-black/40">
            Phone verified. Add an email to finish.
          </p>
        )}
        <button type="submit" className={btnClass} disabled={busy || !loaded}>
          {busy ? "…" : "Continue"}
        </button>
      </form>
    );
  }

  if (pendingCode) {
    return (
      <form onSubmit={(e) => void verifyCode(e)} className="w-full space-y-5 text-left">
        <ClerkCaptcha />
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
        ) : (
          <p className="text-[13px] text-black/40">
            Sent to {channel === "email" ? email.trim() : toE164(phone)}
          </p>
        )}
        <button type="submit" className={btnClass} disabled={busy || !loaded}>
          {busy ? "Verifying…" : "Verify"}
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
              setNeedEmail(false);
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
      <form onSubmit={(e) => void sendCode(e)} className="space-y-5">
        {channel === "phone" ? (
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
            <p className="mt-2 text-[12px] text-black/35">
              Kenya mobiles (+254). We’ll text a 6-digit code.
            </p>
          </div>
        ) : (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className={labelClass} htmlFor="kc-email">
                Email
              </label>
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
            </div>
            <input
              id="kc-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={fieldClass}
              required
            />
          </div>
        )}

        {/* Must be visible before signUp.create — do not hide with empty:hidden */}
        <ClerkCaptcha />

        {fieldError ? (
          <p className="text-[13px] text-black/55">{fieldError}</p>
        ) : null}

        <button type="submit" className={btnClass} disabled={busy || !loaded}>
          {busy ? "…" : "Continue"}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-black/[0.08]" />
        <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-black/30">
          Or
        </span>
        <div className="h-px flex-1 bg-black/[0.08]" />
      </div>

      <div className="flex gap-3">
        {SOCIAL.map(({ strategy, label, Icon }) => (
          <button
            key={strategy}
            type="button"
            onClick={() => void oauth(strategy)}
            disabled={busy || !loaded}
            className="flex h-12 flex-1 items-center justify-center border border-black/12 text-black transition-colors hover:border-black/40 disabled:opacity-40"
            aria-label={`Continue with ${label}`}
          >
            <Icon className="h-[18px] w-[18px]" />
          </button>
        ))}
      </div>
    </div>
  );
}
