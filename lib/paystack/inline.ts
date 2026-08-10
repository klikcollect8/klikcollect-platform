"use client";

declare global {
  interface Window {
    PaystackPop?: {
      new (): {
        resumeTransaction: (
          accessCode: string,
          handlers?: {
            onSuccess?: (tranx: { reference: string }) => void;
            onCancel?: () => void;
            onError?: (error: { message: string }) => void;
          },
        ) => void;
        newTransaction?: (config: Record<string, unknown>) => void;
      };
    };
  }
}

const SCRIPT_URL = "https://js.paystack.co/v1/inline.js";

let scriptPromise: Promise<void> | null = null;

export function loadPaystackInline(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Paystack Inline requires browser"));
  }
  if (window.PaystackPop) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const finishOk = () => {
      if (window.PaystackPop) resolve();
      else reject(new Error("PaystackPop unavailable after load"));
    };

    const existing = document.querySelector(
      `script[src="${SCRIPT_URL}"]`,
    ) as HTMLScriptElement | null;

    if (existing) {
      if (window.PaystackPop) {
        resolve();
        return;
      }
      // Script tag exists but may already have finished loading (load won't re-fire)
      const poll = window.setInterval(() => {
        if (window.PaystackPop) {
          window.clearInterval(poll);
          resolve();
        }
      }, 50);
      window.setTimeout(() => {
        window.clearInterval(poll);
        if (window.PaystackPop) resolve();
        else {
          scriptPromise = null;
          reject(new Error("Paystack script present but PaystackPop missing"));
        }
      }, 8000);
      existing.addEventListener("load", finishOk, { once: true });
      existing.addEventListener(
        "error",
        () => {
          scriptPromise = null;
          reject(new Error("Paystack script failed"));
        },
        { once: true },
      );
      return;
    }

    const s = document.createElement("script");
    s.src = SCRIPT_URL;
    s.async = true;
    s.onload = () => finishOk();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error("Failed to load Paystack Inline"));
    };
    document.body.appendChild(s);
  });

  return scriptPromise;
}

export type InlinePayResult =
  | { ok: true; reference: string }
  | { ok: false; reason: "cancelled" | "error"; message?: string };

/** Open Paystack popup with an access code from Transaction Initialize. */
export async function openPaystackAccessCode(
  accessCode: string,
): Promise<InlinePayResult> {
  await loadPaystackInline();
  if (!window.PaystackPop) {
    return { ok: false, reason: "error", message: "PaystackPop unavailable" };
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: InlinePayResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    try {
      const pop = new window.PaystackPop!();
      pop.resumeTransaction(accessCode, {
        onSuccess: (tranx) => {
          finish({
            ok: true,
            reference: tranx?.reference || "",
          });
        },
        onCancel: () => {
          finish({ ok: false, reason: "cancelled" });
        },
        onError: (error) => {
          finish({
            ok: false,
            reason: "error",
            message: error?.message || "Payment error",
          });
        },
      });
    } catch (e) {
      finish({
        ok: false,
        reason: "error",
        message: e instanceof Error ? e.message : "Inline failed",
      });
    }
  });
}
