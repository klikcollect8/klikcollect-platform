"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { LogOut, Menu, X } from "lucide-react";
import { accountNav, isAccountNavActive } from "./account-nav";
import { useUserAuth } from "@/lib/hooks/useUserAuth";
import { useSignInModal } from "@/components/SignInModalProvider";
import { cn } from "@/lib/utils";
import { ui } from "@/components/system/tokens";

export function AccountShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useClerk();
  const { showSignInModal } = useSignInModal();
  const { user, isSignedIn, loading } = useUserAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (loading) return;
    if (!isSignedIn) {
      showSignInModal("Sign in to view your account", { redirect: "/account" });
      router.replace("/");
    }
  }, [loading, isSignedIn, router, showSignInModal]);

  const handleSignOut = async () => {
    try {
      await signOut({ redirectUrl: "/" });
    } catch {
      window.location.href = "/";
    }
  };

  const Sidebar = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="flex h-full flex-col bg-[#f7f7f5]">
      <div className="px-7 pb-6 pt-9">
        <Link href="/account" onClick={onNavigate} className="block">
          <p className={ui.pageEyebrow}>Account</p>
          <p
            className="mt-2 truncate text-[17px] font-medium tracking-tight text-black"
            style={{ fontFamily: "var(--font-display), sans-serif" }}
          >
            {user?.firstName || "Your account"}
          </p>
          <p className="mt-1 truncate text-[12px] text-black/35">
            {user?.email || "KlikCollect"}
          </p>
        </Link>
      </div>

      <nav className="scrollbar-hide flex-1 space-y-0.5 overflow-y-auto px-5 pb-6">
        {accountNav.map((item) => {
          const Icon = item.icon;
          const active = isAccountNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 px-2 py-2.5 text-[14px]",
                active ? ui.navActive : ui.navIdle,
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  active ? "text-black" : "text-black/30",
                )}
                strokeWidth={1.5}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-7 py-6">
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            void handleSignOut();
          }}
          className="flex items-center gap-2.5 text-[13px] font-medium text-black/40 transition-colors hover:text-black"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.5} />
          Sign out
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f5]">
        <p className="text-[11px] uppercase tracking-[0.2em] text-black/35">
          Connecting
        </p>
      </div>
    );
  }

  if (!isSignedIn) return null;

  return (
    <div className="min-h-screen bg-[#f7f7f5] text-black">
      <aside className={cn("fixed inset-y-0 left-0 z-40 hidden lg:block", ui.shellAside)}>
        <Sidebar />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/35"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[min(280px,88vw)] bg-[#f7f7f5]">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 z-10 p-2 text-black/35 hover:text-black"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className={ui.shellAsidePad}>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-[#f7f7f5]/90 px-8 backdrop-blur-sm sm:px-12 lg:px-16 xl:px-20">
          <button
            type="button"
            className="p-1.5 text-black lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" strokeWidth={1.5} />
          </button>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-black/35">
            Account
          </p>
          <Link
            href="/shop"
            className="ml-auto text-[13px] text-black/40 transition-colors hover:text-black"
          >
            Back to shop
          </Link>
        </header>

        <main className={ui.shellMain}>{children}</main>
      </div>
    </div>
  );
}
