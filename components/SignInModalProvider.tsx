"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@clerk/nextjs";
import SignInModal, { type AuthModalMode } from "./SignInModal";
import { persistAuthRedirect } from "@/lib/auth/return-path";

export type AuthModalOptions = {
  mode?: AuthModalMode;
  redirect?: string;
};

interface SignInModalContextType {
  showSignInModal: (message?: string, options?: AuthModalOptions) => void;
  hideSignInModal: () => void;
}

const SignInModalContext = createContext<SignInModalContextType | undefined>(
  undefined,
);

const STORAGE_KEY = "kc_auth_modal";

type StoredAuthIntent = {
  mode?: AuthModalMode;
  message?: string | null;
  redirect?: string;
};

function readStoredIntent(): StoredAuthIntent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(STORAGE_KEY);
    return JSON.parse(raw) as StoredAuthIntent;
  } catch {
    return null;
  }
}

/** Persist intent then navigate - used by /sign-in bridges & middleware redirects. */
export function queueAuthModal(intent: StoredAuthIntent) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(intent));
}

/** Storefront auth overlay - same pattern as bag / search. */
export function SignInModalProvider({ children }: { children: ReactNode }) {
  const { isSignedIn } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthModalMode>("sign-in");
  const [message, setMessage] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState("/");

  const showSignInModal = useCallback(
    (customMessage?: string, options?: AuthModalOptions) => {
      const redirect =
        options?.redirect?.startsWith("/") ? options.redirect : "/";
      setMessage(customMessage?.trim() || null);
      setMode(options?.mode ?? "sign-in");
      setRedirectUrl(redirect);
      persistAuthRedirect(redirect);
      setOpen(true);
    },
    [],
  );

  const hideSignInModal = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (isSignedIn && open) hideSignInModal();
  }, [isSignedIn, open, hideSignInModal]);

  useEffect(() => {
    const stored = readStoredIntent();
    if (stored) {
      showSignInModal(stored.message ?? undefined, {
        mode: stored.mode ?? "sign-in",
        redirect: stored.redirect,
      });
    }

    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<StoredAuthIntent>).detail || {};
      showSignInModal(detail.message ?? undefined, {
        mode: detail.mode ?? "sign-in",
        redirect: detail.redirect,
      });
    };

    window.addEventListener("openAuthModal", onOpen as EventListener);
    return () =>
      window.removeEventListener("openAuthModal", onOpen as EventListener);
  }, [showSignInModal]);

  return (
    <SignInModalContext.Provider value={{ showSignInModal, hideSignInModal }}>
      {children}
      <SignInModal
        isOpen={open}
        mode={mode}
        message={message}
        redirectUrl={redirectUrl}
        onModeChange={setMode}
        onClose={hideSignInModal}
      />
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
