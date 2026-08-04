import Link from "next/link";

const COLUMNS = [
  {
    title: "Shop",
    links: [
      { label: "Catalogue", href: "/shop" },
      { label: "Vendors", href: "/brands" },
      { label: "Categories", href: "/categories" },
      { label: "Today's deals", href: "/todays-deals" },
      { label: "Search", href: "/search" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Your account", href: "/account" },
      { label: "Orders", href: "/account/orders" },
      { label: "Saved items", href: "/saved" },
      { label: "Addresses", href: "/account/addresses" },
      { label: "Receipts", href: "/account/receipts/lookup" },
    ],
  },
  {
    title: "Sell",
    links: [
      { label: "Sell on KlikCollect", href: "/sell" },
      { label: "Vendor dashboard", href: "/app" },
      { label: "Sell application", href: "/account/sell-application" },
      { label: "Vendor stores", href: "/brands" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "Customer service", href: "/customer-service" },
      { label: "How click & collect works", href: "/customer-service" },
      { label: "Payments & pickup", href: "/account/payments" },
      { label: "Order lookup", href: "/account/receipts/lookup" },
    ],
  },
] as const;

/** Desktop storefront footer — hidden below `lg` (mobile uses bottom nav). */
export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="hidden lg:block">
      <div className="border-t border-black/[0.08] bg-[#111111] text-white">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-10 py-10 lg:flex-row lg:items-end lg:justify-between lg:px-14 xl:px-20">
          <div className="max-w-xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/45">
              Nairobi · click &amp; collect
            </p>
            <h2 className="mt-3 text-[clamp(1.6rem,2.2vw,2.15rem)] font-semibold leading-[1.15] tracking-tight">
              Groceries and everyday essentials from vendors near you.
            </h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/shop"
              className="inline-flex min-h-11 items-center bg-white px-5 text-[13px] font-medium tracking-wide text-black transition-opacity hover:opacity-90"
            >
              Shop catalogue
            </Link>
            <Link
              href="/sell"
              className="inline-flex min-h-11 items-center border border-white/25 px-5 text-[13px] font-medium tracking-wide text-white transition-colors hover:bg-white/10"
            >
              Become a vendor
            </Link>
          </div>
        </div>
      </div>

      <div className="border-t border-black/[0.06] bg-[#f7f7f5]">
        <div className="mx-auto w-full max-w-[1600px] px-10 py-14 lg:px-14 xl:px-20 xl:py-16">
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
            <div className="lg:col-span-4">
              <Link
                href="/"
                className="inline-block text-[1.65rem] font-semibold tracking-tight text-black"
              >
                KLIKCOLLECT
                <span className="align-super text-[0.42em] font-medium">™</span>
              </Link>
              <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-black/55">
                Pay online, pick up in person. Built for Nairobi neighbourhoods —
                Westlands, Kilimani, CBD, and beyond.
              </p>
              <dl className="mt-8 grid max-w-xs grid-cols-2 gap-x-6 gap-y-4 text-[13px]">
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.16em] text-black/35">
                    Market
                  </dt>
                  <dd className="mt-1 font-medium text-black/80">Nairobi, KE</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.16em] text-black/35">
                    Currency
                  </dt>
                  <dd className="mt-1 font-medium text-black/80">KES</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.16em] text-black/35">
                    Fulfilment
                  </dt>
                  <dd className="mt-1 font-medium text-black/80">
                    Click &amp; collect
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.16em] text-black/35">
                    Payments
                  </dt>
                  <dd className="mt-1 font-medium text-black/80">
                    Card · M-Pesa
                  </dd>
                </div>
              </dl>
            </div>

            <div className="grid grid-cols-2 gap-10 sm:grid-cols-4 lg:col-span-8 lg:gap-8">
              {COLUMNS.map((column) => (
                <div key={column.title}>
                  <p className="mb-5 text-[11px] font-medium uppercase tracking-[0.2em] text-black/40">
                    {column.title}
                  </p>
                  <ul className="space-y-3.5 text-[14px] leading-snug text-black/75">
                    {column.links.map((link) => (
                      <li key={`${column.title}-${link.label}`}>
                        <Link
                          href={link.href}
                          className="transition-opacity hover:opacity-45"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-14 flex flex-col gap-4 border-t border-black/10 pt-7 text-[12px] text-black/45 lg:flex-row lg:items-center lg:justify-between">
            <p>
              © {year} KlikCollect
              <span className="align-super text-[0.75em]">™</span>
              {" · "}
              Groceries and everyday essentials.
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <Link
                href="/customer-service"
                className="transition-colors hover:text-black/70"
              >
                Help centre
              </Link>
              <Link href="/sell" className="transition-colors hover:text-black/70">
                Sell
              </Link>
              <Link href="/brands" className="transition-colors hover:text-black/70">
                Vendors
              </Link>
              <span className="text-black/30">Nairobi · KES</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
