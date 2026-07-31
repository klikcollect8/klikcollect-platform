"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useClerk, useSignIn, useSignUp } from "@clerk/nextjs";
import { queueAuthModal } from "@/components/SignInModalProvider";

export default function SSOCallbackPage() {
  const clerk = useClerk();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const router = useRouter();
  const hasRun = useRef(false);

  useEffect(() => {
    void (async () => {
      if (!clerk.loaded || hasRun.current) return;
      hasRun.current = true;

      const goHome = (decorateUrl: (path: string) => string) => {
        const url = decorateUrl("/");
        if (url.startsWith("http")) window.location.href = url;
        else router.replace(url);
      };

      const reopenAuth = (message?: string) => {
        queueAuthModal({
          mode: "sign-up",
          message: message ?? "Finish signing in",
          redirect: "/",
        });
        router.replace("/");
      };

      try {
        if (signIn.status === "complete") {
          await signIn.finalize({
            navigate: ({ session, decorateUrl }) => {
              if (session?.currentTask) return;
              goHome(decorateUrl);
            },
          });
          return;
        }

        if (signUp.isTransferable) {
          await signIn.create({ transfer: true });
          // After transfer create, runtime status may be complete even if types exclude it.
          if ((signIn.status as string) === "complete") {
            await signIn.finalize({
              navigate: ({ session, decorateUrl }) => {
                if (session?.currentTask) return;
                goHome(decorateUrl);
              },
            });
            return;
          }
          reopenAuth();
          return;
        }

        if (
          signIn.status === "needs_first_factor" &&
          !signIn.supportedFirstFactors?.every(
            (f) => f.strategy === "enterprise_sso",
          )
        ) {
          reopenAuth("Continue with phone or email");
          return;
        }

        if (signIn.isTransferable) {
          await signUp.create({ transfer: true });
          if (signUp.status === "complete") {
            await signUp.finalize({
              navigate: ({ session, decorateUrl }) => {
                if (session?.currentTask) return;
                goHome(decorateUrl);
              },
            });
            return;
          }
          // Still missing fields (e.g. phone) — send back to auth modal
          reopenAuth("Add your phone to finish signing up");
          return;
        }

        if (signUp.status === "complete") {
          await signUp.finalize({
            navigate: ({ session, decorateUrl }) => {
              if (session?.currentTask) return;
              goHome(decorateUrl);
            },
          });
          return;
        }

        if (
          signIn.status === "needs_second_factor" ||
          signIn.status === "needs_new_password"
        ) {
          reopenAuth();
          return;
        }

        const sessionId =
          signIn.existingSession?.sessionId || signUp.existingSession?.sessionId;
        if (sessionId) {
          await clerk.setActive({
            session: sessionId,
            navigate: ({ session, decorateUrl }) => {
              if (session?.currentTask) return;
              goHome(decorateUrl);
            },
          });
          return;
        }

        // Fallback: incomplete OAuth — reopen auth
        reopenAuth();
      } catch {
        reopenAuth("Social sign-in failed. Try again.");
      }
    })();
  }, [clerk, signIn, signUp, router]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center bg-[#f6f4ef] text-[13px] text-black/45">
      Completing sign-in…
      {/* Captcha required when OAuth transfers into a sign-up */}
      <div id="clerk-captcha" />
    </div>
  );
}
