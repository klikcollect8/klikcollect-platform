"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { useUserAuth } from "@/lib/hooks/useUserAuth";
import { Ban, UserX, Phone, Mail, LogOut } from "lucide-react";

export default function AccountRestrictedPage() {
  const router = useRouter();
  const { signOut } = useClerk();
  const { user, loading, isSignedIn, userStatus } = useUserAuth();

  useEffect(() => {
    if (loading) return;
    if (!isSignedIn) {
      router.replace("/sign-in?redirect=/");
      return;
    }
    if (userStatus === "active" || !userStatus) {
      router.replace("/");
    }
  }, [loading, isSignedIn, userStatus, router]);

  if (loading || !userStatus || userStatus === "active") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f5]">
        <p className="text-[12px] uppercase tracking-[0.22em] text-black/40">
          Loading
        </p>
      </div>
    );
  }

  const isBanned = userStatus === "banned";
  const StatusIcon = isBanned ? Ban : UserX;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f7f5] px-6 py-16">
      <div className="w-full max-w-lg border border-black/10 bg-transparent p-8 sm:p-10">
        <StatusIcon className="mb-6 h-8 w-8 text-black" strokeWidth={1.25} />
        <p className="mb-3 text-[12px] font-medium uppercase tracking-[0.24em] text-black/40">
          Account
        </p>
        <h1 className="text-[clamp(1.75rem,3vw,2.25rem)] font-medium tracking-tight">
          {isBanned ? "Account suspended" : "Account temporarily disabled"}
        </h1>
        <p className="mt-2 text-[13px] text-black/45">{user?.email || ""}</p>
        <p className="mt-6 text-[15px] leading-relaxed text-black/60">
          {isBanned
            ? "Your account has been suspended due to a violation of our terms of service."
            : "Your account access has been restricted. Contact support to resolve this."}
        </p>

        <div className="mt-10 space-y-4 border-t border-black/[0.06] pt-8">
          <div className="flex items-center gap-4">
            <Phone className="h-4 w-4 text-black/40" />
            <div>
              <p className="text-[13px] font-medium">Phone</p>
              <p className="text-[13px] text-black/50">+254 700 000 000</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Mail className="h-4 w-4 text-black/40" />
            <div>
              <p className="text-[13px] font-medium">Email</p>
              <p className="text-[13px] text-black/50">
                support@klikcollect.com
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void signOut({ redirectUrl: "/" })}
          className="mt-10 flex w-full items-center justify-center gap-2 border border-black py-3.5 text-[12px] font-medium uppercase tracking-[0.16em] transition-colors hover:bg-black hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}
