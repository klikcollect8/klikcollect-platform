import Link from "next/link";

const LINKS = [
  { label: "Shop", href: "/shop" },
  { label: "Vendors", href: "/brands" },
  { label: "Deals", href: "/todays-deals" },
  { label: "Sell", href: "/sell" },
  { label: "Account", href: "/account" },
  { label: "Help", href: "/customer-service" },
] as const;

/** Desktop storefront footer — quiet, canvas-matched; hidden on mobile. */
export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="hidden border-t border-black/[0.06] bg-[#f7f7f5] lg:block">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 px-10 py-12 lg:px-14 xl:px-20">
        <div className="flex flex-wrap items-baseline justify-between gap-x-10 gap-y-6">
          <Link
            href="/"
            className="text-[13px] font-medium uppercase tracking-[0.16em] text-black/70 transition-opacity hover:opacity-45"
          >
            KLIKCOLLECT
            <span className="align-super text-[0.55em] tracking-normal">™</span>
          </Link>

          <nav
            aria-label="Footer"
            className="flex flex-wrap items-center gap-x-7 gap-y-3"
          >
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[13px] font-medium text-black/45 transition-opacity hover:opacity-100"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-[12px] text-black/35">
          <p>Nairobi · KES · Click &amp; collect</p>
          <p>© {year} KlikCollect</p>
        </div>
      </div>
    </footer>
  );
}
