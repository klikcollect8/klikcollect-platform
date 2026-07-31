"use client";

import { useEffect } from "react";
import { useClerk } from "@clerk/nextjs";

export default function SignOutPage() {
  const { signOut } = useClerk();

  useEffect(() => {
    void signOut({ redirectUrl: "/" });
  }, [signOut]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-[#1e3a8a] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Signing out…</p>
      </div>
    </div>
  );
}
