"use client";

import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-black/[0.06] bg-[#f7f7f5]">
      <div className="mx-auto w-full max-w-[1600px] px-6 py-20 sm:px-10 lg:px-14 xl:px-20">
        <div className="grid gap-16 md:grid-cols-12">
          <div className="md:col-span-5">
            <p className="text-[12px] uppercase tracking-[0.22em] text-black/40">
              KlikCollect
            </p>
            <h2 className="mt-5 max-w-lg text-[clamp(1.5rem,2.5vw,2rem)] font-medium leading-[1.15] tracking-tight">
              Shop groceries &amp; essentials. Click &amp; collect.
            </h2>
            <Link
              href="/shop"
              className="mt-6 inline-flex items-center gap-2 text-[14px] font-medium underline underline-offset-4"
            >
              Continue shopping <span aria-hidden>→</span>
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-8 md:col-span-7 md:grid-cols-3">
            <div>
              <p className="mb-4 text-[11px] uppercase tracking-[0.18em] text-black/40">
                Shop
              </p>
              <ul className="space-y-3 text-[14px]">
                {[
                  ["Home", "/"],
                  ["Catalogue", "/shop"],
                  ["Vendors", "/brands"],
                  ["Deals", "/todays-deals"],
                  ["Sell", "/sell"],
                ].map(([label, href]) => (
                  <li key={href}>
                    <Link href={href} className="hover:opacity-50">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-4 text-[11px] uppercase tracking-[0.18em] text-black/40">
                Account
              </p>
              <ul className="space-y-3 text-[14px]">
                {[
                  ["Your account", "/account"],
                  ["Orders", "/account/orders"],
                  ["Wishlist", "/wishlist"],
                  ["Customer service", "/customer-service"],
                ].map(([label, href]) => (
                  <li key={href}>
                    <Link href={href} className="hover:opacity-50">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-4 text-[11px] uppercase tracking-[0.18em] text-black/40">
                Contact
              </p>
              <p className="text-[14px] leading-relaxed text-black/70">
                Nairobi · KES
                <br />
                Click &amp; collect essentials
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col justify-between gap-4 border-t border-black/10 pt-6 text-[12px] text-black/45 sm:flex-row">
          <p>KLIKCOLLECT® — groceries and everyday essentials.</p>
          <p>© {new Date().getFullYear()} KlikCollect</p>
        </div>
      </div>
    </footer>
  );
}
