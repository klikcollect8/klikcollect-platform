"use client";

import { Shield } from "lucide-react";
import { useClerk } from "@clerk/nextjs";
import { useUserAuth } from "@/lib/hooks/useUserAuth";
import { useToast } from "@/components/ToastProvider";
import { ui } from "@/components/system/tokens";
import { cn } from "@/lib/utils";

export default function AccountSecurityPage() {
  const { openUserProfile } = useClerk();
  const { user } = useUserAuth();
  const { showToast } = useToast();

  const openClerk = () => {
    openUserProfile();
    showToast("Manage password, MFA, and sessions in Clerk.", "success");
  };

  return (
    <div className="space-y-10">
      <div>
        <p className={ui.pageEyebrow}>Account</p>
        <h1 className={`mt-3 ${ui.pageTitle}`}>Security</h1>
        <p className={cn("mt-2", ui.pageDesc)}>
          Password, two-factor authentication, and connected accounts for{" "}
          {user?.email}.
        </p>
      </div>

      <section className={ui.panel}>
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-[var(--kc-radius-sm)] bg-[var(--kc-canvas)]">
              <Shield
                className="h-5 w-5 text-[var(--kc-ink)]"
                strokeWidth={1.75}
              />
            </span>
            <div>
              <p className="text-[14px] font-semibold text-[var(--kc-ink)]">
                Clerk account settings
              </p>
              <p className="mt-0.5 max-w-md text-[13px] text-[var(--kc-mute)]">
                Update your password, enable authenticator apps, and review
                active sessions.
              </p>
            </div>
          </div>
          <button type="button" onClick={openClerk} className={ui.btnPrimary}>
            Open security settings
          </button>
        </div>
      </section>
    </div>
  );
}
