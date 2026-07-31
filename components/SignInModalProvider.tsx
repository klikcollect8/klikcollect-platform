"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useRouter } from "next/navigation";

interface SignInModalContextType {
  showSignInModal: (message?: string) => void;
  hideSignInModal: () => void;
}

const SignInModalContext = createContext<SignInModalContextType | undefined>(
  undefined,
);

/** Sends users to the branded /sign-in page (no modal). */
export function SignInModalProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

  const showSignInModal = (customMessage?: string) => {
    const params = new URLSearchParams();
    if (customMessage?.trim()) params.set("notice", customMessage.trim());
    const qs = params.toString();
    router.push(qs ? `/sign-in?${qs}` : "/sign-in");
  };

  return (
    <SignInModalContext.Provider
      value={{ showSignInModal, hideSignInModal: () => undefined }}
    >
      {children}
    </SignInModalContext.Provider>
  );
}

export function useSignInModal() {
  const context = useContext(SignInModalContext);
  if (context === undefined) {
    throw new Error("useSignInModal must be used within a SignInModalProvider");
  }
  return context;
}
