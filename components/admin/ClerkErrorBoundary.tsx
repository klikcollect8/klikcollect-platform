"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Catch Clerk network/session runtime errors so the admin login
 * surface stays usable instead of a Next.js error overlay.
 */
export default class ClerkErrorBoundary extends Component<
  { children: ReactNode; onReset?: () => void },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error?.message || "Authentication error",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ClerkErrorBoundary]", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const isClerkNetwork =
      /ClerkJS|Failed to fetch|Network error/i.test(this.state.message);

    return (
      <div className="space-y-5 py-4 text-left">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-black/35">
          {isClerkNetwork ? "Connection issue" : "Sign-in error"}
        </p>
        <h2 className="text-[22px] font-medium tracking-tight text-black">
          {isClerkNetwork
            ? "Couldn’t reach Clerk"
            : "Something went wrong signing in"}
        </h2>
        <p className="text-[14px] leading-relaxed text-black/45">
          {isClerkNetwork
            ? "Check your network, disable blockers for clerk.accounts.dev, then reset the session and try again."
            : this.state.message}
        </p>
        <button
          type="button"
          className="inline-flex w-full items-center justify-center bg-black px-5 py-3 text-[12px] font-medium uppercase tracking-[0.14em] text-white transition-opacity hover:opacity-80"
          onClick={() => {
            this.setState({ hasError: false, message: "" });
            this.props.onReset?.();
            window.location.assign("/admin/login");
          }}
        >
          Reload login
        </button>
      </div>
    );
  }
}
