"use client";

import { usePathname } from "next/navigation";
import { useSignInModal } from "@/components/SignInModalProvider";
import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  className?: string;
  mode?: "sign-in" | "sign-up";
  /** Override return path (defaults to current pathname) */
  redirect?: string;
  message?: string;
};

/**
 * Opens the storefront auth modal with a reliable return path.
 * Prefer this over Clerk SignInButton mode="redirect" (bridge loses OS context).
 */
export default function AuthModalTrigger({
  children,
  className,
  mode = "sign-in",
  redirect,
  message,
}: Props) {
  const pathname = usePathname();
  const { showSignInModal } = useSignInModal();

  return (
    <button
      type="button"
      className={cn(className)}
      onClick={() =>
        showSignInModal(message, {
          mode,
          redirect: redirect || pathname || "/",
        })
      }
    >
      {children}
    </button>
  );
}
