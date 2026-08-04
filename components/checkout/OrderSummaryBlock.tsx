"use client";

import Image from "next/image";
import { ChevronDown } from "lucide-react";
import type { CartItem } from "@/types";
import { formatPrice } from "@/lib/currency";
import { resolveProductImage } from "@/lib/product-image";
import { cn } from "@/lib/utils";

type Props = {
  items: CartItem[];
  open: boolean;
  onToggle: () => void;
  subtotal: number;
  deliveryMinor: number;
  grandTotal: number;
  unitPrice: (item: CartItem) => number;
  /** Always show line items (desktop sidebar). */
  forceOpen?: boolean;
  /** Hide the section title (when parent already labels it). */
  hideTitle?: boolean;
};

/** Expandable order summary + price breakdown. */
export default function OrderSummaryBlock({
  items,
  open,
  onToggle,
  subtotal,
  deliveryMinor,
  grandTotal,
  unitPrice,
  forceOpen = false,
  hideTitle = false,
}: Props) {
  const count = items.reduce((n, i) => n + i.quantity, 0);
  const deliveryMajor = deliveryMinor / 100;
  const expanded = forceOpen || open;

  return (
    <section className="space-y-5">
      <div>
        {!hideTitle ? (
          <h2 className="text-[17px] font-semibold tracking-tight">
            Order summary
          </h2>
        ) : null}

        {!forceOpen ? (
          <button
            type="button"
            onClick={onToggle}
            className={cn(
              "flex w-full items-center gap-3 border-y border-black/[0.06] py-4 text-left",
              !hideTitle && "mt-4",
            )}
            aria-expanded={expanded}
          >
            <div className="relative h-11 w-11 shrink-0 overflow-hidden bg-black/[0.04]">
              {items[0]?.product?.image ? (
                <Image
                  src={resolveProductImage(items[0].product.image)}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="44px"
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium">
                {count} {count === 1 ? "item" : "items"}
              </p>
              <p className="truncate text-[12px] text-black/45">
                Click &amp; collect · Nairobi
              </p>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-black/35 transition-transform",
                expanded && "rotate-180",
              )}
              strokeWidth={1.75}
            />
          </button>
        ) : (
          <p className="text-[13px] text-black/45">
            {count} {count === 1 ? "item" : "items"} · Click &amp; collect
          </p>
        )}

        {expanded ? (
          <ul
            className={cn(
              "divide-y divide-black/[0.06]",
              !forceOpen && "border-b border-black/[0.06]",
              forceOpen && "mt-4 border-t border-black/[0.06]",
            )}
          >
            {items.map((item) => (
              <li
                key={item.offerId || item.product.id}
                className="flex gap-3 py-3.5"
              >
                <div className="relative h-14 w-14 shrink-0 overflow-hidden bg-black/[0.03]">
                  {item.product.image ? (
                    <Image
                      src={resolveProductImage(item.product.image)}
                      alt={item.product.name || "Product"}
                      fill
                      className="object-cover"
                      sizes="56px"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium">
                    {item.product.name}
                  </p>
                  <p className="mt-0.5 text-[12px] text-black/45">
                    Qty {item.quantity}
                  </p>
                </div>
                <p className="shrink-0 text-[14px] font-medium tabular-nums">
                  {formatPrice(unitPrice(item) * item.quantity)}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="space-y-2.5 text-[14px]">
        <div className="flex justify-between gap-4">
          <span className="text-black/50">Subtotal</span>
          <span className="tabular-nums">{formatPrice(subtotal)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-black/50">Pickup</span>
          <span className="tabular-nums text-black/70">
            {deliveryMinor > 0 ? formatPrice(deliveryMajor) : "Free"}
          </span>
        </div>
        <div className="flex justify-between gap-4 border-t border-black/[0.06] pt-3 text-[16px] font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatPrice(grandTotal)}</span>
        </div>
      </div>
    </section>
  );
}
