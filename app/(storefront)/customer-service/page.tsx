"use client";

import Link from "next/link";
import { StorePage, StoreHeading } from "@/components/marketplace/StorePage";

const LINKS = [
  {
    title: "Track your order",
    body: "View status and pickup details",
    href: "/account/orders",
  },
  {
    title: "Returns",
    body: "Return or exchange items",
    href: "/account/orders",
  },
  {
    title: "Contact",
    body: "support@klikcollect.com",
    href: "mailto:support@klikcollect.com",
  },
];

const FAQ = [
  {
    q: "How do I place an order?",
    a: "Browse products, add them to your bag, and checkout. Choose a pickup time and confirm.",
  },
  {
    q: "When can I collect?",
    a: "Schedule pickup for the next 7 days. Most orders are ready within a few hours.",
  },
  {
    q: "Can I cancel?",
    a: "Yes, before confirmation. After that, contact support for help.",
  },
  {
    q: "What's the return policy?",
    a: "Return items within 30 days in original condition with your order confirmation.",
  },
];

export default function CustomerServicePage() {
  return (
    <StorePage>
      <StoreHeading
        eyebrow="Help"
        title="Customer service"
        description="Quick answers and ways to get support"
      />

      <div className="mb-20 grid gap-0 border-t border-black/[0.06] md:grid-cols-3">
        {LINKS.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="border-b border-black/[0.06] py-10 transition-opacity hover:opacity-55 md:border-r md:px-8 md:[&:last-child]:border-r-0"
          >
            <h2 className="text-[20px] font-medium tracking-tight">{item.title}</h2>
            <p className="mt-3 text-[15px] text-black/50">{item.body}</p>
          </Link>
        ))}
      </div>

      <div className="border-t border-black/[0.06] pt-14">
        <h2 className="mb-10 text-[clamp(1.5rem,2.5vw,2rem)] font-medium tracking-tight">
          FAQ
        </h2>
        <div className="max-w-3xl space-y-10">
          {FAQ.map((item) => (
            <div key={item.q}>
              <h3 className="text-[17px] font-medium">{item.q}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-black/55">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </StorePage>
  );
}
