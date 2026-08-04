"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, Map, ScanLine, ListOrdered, UserRound } from "lucide-react";

const links = [
  { href: "/driver", label: "Map", icon: Map, exact: true },
  { href: "/driver/routes", label: "Jobs", icon: ListOrdered },
  { href: "/driver/scan", label: "Scan", icon: ScanLine },
  { href: "/driver/history", label: "Activity", icon: History },
  { href: "/driver/profile", label: "Account", icon: UserRound },
];

export default function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isMapHome = pathname === "/driver";

  return (
    <div className="min-h-[100dvh] bg-[#eceeea] font-[family-name:var(--font-jakarta)] text-[#111]">
      <main
        className={isMapHome ? "" : "mx-auto max-w-lg px-4 pb-32 pt-5 sm:px-5"}
      >
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2">
        <ul className="mx-auto flex max-w-lg items-center justify-between rounded-[22px] bg-[#111]/94 px-1.5 py-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.28)] ring-1 ring-white/10 backdrop-blur-xl">
          {links.map((l) => {
            const active = l.exact
              ? pathname === l.href
              : pathname === l.href || pathname.startsWith(`${l.href}/`);
            const Icon = l.icon;
            return (
              <li key={l.href} className="flex-1">
                <Link
                  href={l.href}
                  className={`flex flex-col items-center gap-0.5 rounded-[16px] px-1 py-2.5 transition ${
                    active
                      ? "bg-white text-[#111]"
                      : "text-white/45 hover:text-white/75"
                  }`}
                >
                  <Icon
                    className="h-[20px] w-[20px]"
                    strokeWidth={active ? 2.4 : 1.8}
                  />
                  <span className="text-[10px] font-semibold tracking-wide">
                    {l.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
