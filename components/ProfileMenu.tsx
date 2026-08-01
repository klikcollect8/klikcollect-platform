"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useClerk, useUser } from "@clerk/nextjs";
import { X } from "lucide-react";

const LINKS = [
  { href: "/account", label: "Account" },
  { href: "/account/orders", label: "Orders" },
  { href: "/saved", label: "Saved" },
  { href: "/account/preferences", label: "Preferences" },
] as const;

/** Flat full-screen account panel — no blur, no depth motion. */
export default function ProfileMenu() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  if (!isLoaded || !user) return null;

  const name =
    user.fullName ||
    user.firstName ||
    user.primaryEmailAddress?.emailAddress?.split("@")[0] ||
    "Account";
  const email =
    user.primaryEmailAddress?.emailAddress ||
    user.primaryPhoneNumber?.phoneNumber ||
    "";
  const initial = (name.trim().charAt(0) || "K").toUpperCase();

  const overlay =
    mounted && open && typeof document !== "undefined"
      ? createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Account"
            className="fixed inset-0 z-[9999] bg-[#f7f7f5]"
          >
            <div className="relative mx-auto flex h-full w-full max-w-[1200px] flex-col px-5 sm:px-8 lg:px-12">
              <header className="absolute inset-x-5 top-0 z-10 flex items-center justify-between pt-5 sm:inset-x-8 sm:pt-7 lg:inset-x-12">
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-black/40">
                  Account
                </p>
                <button
                  type="button"
                  onClick={handleClose}
                  className="inline-flex items-center gap-2 text-[13px] text-black/45 transition-colors hover:text-black"
                  aria-label="Close"
                >
                  <span className="hidden sm:inline">Esc</span>
                  <X className="h-5 w-5" strokeWidth={1.5} />
                </button>
              </header>

              <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto py-20">
                <div className="w-full max-w-[320px] text-center">
                  <p className="text-[clamp(1.5rem,3vw,2rem)] font-medium tracking-tight text-black">
                    {name}
                  </p>
                  {email ? (
                    <p className="mt-2 text-[14px] leading-relaxed text-black/45">
                      {email}
                    </p>
                  ) : null}

                  <nav className="mt-10 flex flex-col">
                    {LINKS.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={handleClose}
                        className="border-b border-black/[0.08] py-3.5 text-[13px] font-medium uppercase tracking-[0.14em] text-black/70 transition-colors hover:text-black"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </nav>

                  <button
                    type="button"
                    onClick={() => {
                      handleClose();
                      void signOut({ redirectUrl: "/" });
                    }}
                    className="mt-10 text-[13px] text-black/45 underline decoration-black/20 underline-offset-[5px] transition-colors hover:text-black hover:decoration-black"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 w-11 items-center justify-center text-[13px] font-medium text-black/70 transition-opacity hover:opacity-50"
        aria-label="Open account"
      >
        {user.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.imageUrl}
            alt=""
            className="h-9 w-9 object-cover"
          />
        ) : (
          <span>{initial}</span>
        )}
      </button>
      {overlay}
    </>
  );
}
