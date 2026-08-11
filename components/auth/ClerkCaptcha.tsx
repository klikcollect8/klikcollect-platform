"use client";

/**
 * Clerk bot-protection widget for custom sign-up / sign-in-or-up.
 * Must stay visible in the DOM (never display:none) before signUp.create().
 * Hidden widgets force an invisible CAPTCHA that auto-blocks testers.
 */
export default function ClerkCaptcha() {
  return (
    <div
      id="clerk-captcha"
      data-cl-theme="light"
      data-cl-size="flexible"
      className="flex min-h-[4px] w-full justify-center py-1 [&:not(:empty)]:min-h-[68px] [&:not(:empty)]:py-2"
    />
  );
}
