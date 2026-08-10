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
  fulfilment?: "pickup" | "delivery" | null;
  fulfilmentFeeLabel?: string;
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
  fulfilment = null,
  fulfilmentFeeLabel,
}: Props) {
  const count = items.reduce((n, i) => n + i.quantity, 0);
  const deliveryMajor = deliveryMinor / 100;
  const expanded = forceOpen || open;
  const feeLabel =
    fulfilmentFeeLabel ||
    (fulfilment === "delivery"
      ? "Delivery"
      : fulfilment === "pickup"
        ? "Pickup"
        : "Fulfilment");
  const modeHint =
    fulfilment === "delivery"
      ? "Delivery"
      : fulfilment === "pickup"
        ? "Click & collect"
        : "Nairobi";

  return (
    <section className="space-y-5">
      <div>
        {!hideTitle ? (
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-black/40">
            Summary
          </p>
        ) : null}

        {!forceOpen ? (
          <button
            type="button"
            onClick={onToggle}
            className={cn(
              "flex w-full items-center gap-3 border border-black/[0.08] bg-white/50 px-3 py-3 text-left",
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
                {count} {count === 1 ? "item" : "items"} ·{" "}
                {formatPrice(grandTotal)}
              </p>
              <p className="truncate text-[12px] text-black/45">{modeHint}</p>
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
          <p className="mt-1 text-[13px] text-black/45">
            {count} {count === 1 ? "item" : "items"} · {modeHint}
          </p>
        )}

        {expanded ? (
          <div
            className={cn(
              "scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              !forceOpen && "mt-3",
              forceOpen && "mt-4",
            )}
          >
            {items.map((item) => {
              const lineTotal = unitPrice(item) * item.quantity;
              const vendor =
                item.vendorName || item.product.vendorName || "";
              return (
                <article
                  key={item.offerId || item.product.id}
                  className="w-[140px] shrink-0 snap-start border border-black/[0.08] bg-white/50"
                >
                  <div className="relative aspect-square w-full overflow-hidden bg-black/[0.03]">
                    {item.product.image ? (
                      <Image
                        src={resolveProductImage(item.product.image)}
                        alt={item.product.name || "Product"}
                        fill
                        className="object-cover"
                        sizes="140px"
                      />
                    ) : null}
                  </div>
                  <div className="space-y-1 p-2.5">
                    <p className="line-clamp-2 text-[12px] font-medium leading-snug">
                      {item.product.name}
                    </p>
                    <p className="truncate text-[11px] text-black/40">
                      Qty {item.quantity}
                      {vendor ? ` · ${vendor}` : ""}
                    </p>
                    <p className="text-[13px] font-medium tabular-nums">
                      {formatPrice(lineTotal)}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="space-y-2.5 text-[14px]">
        <div className="flex justify-between gap-4">
          <span className="text-black/50">Subtotal</span>
          <span className="tabular-nums">{formatPrice(subtotal)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-black/50">{feeLabel}</span>
          <span className="tabular-nums text-black/70">
            {deliveryMinor > 0
              ? formatPrice(deliveryMajor)
              : fulfilment === "delivery"
                ? "—"
                : "No fee"}
          </span>
        </div>
        <div className="flex justify-between gap-4 border-t border-black/[0.06] pt-3 text-[17px] font-semibold tracking-tight">
          <span>Total</span>
          <span className="tabular-nums">{formatPrice(grandTotal)}</span>
        </div>
      </div>
    </section>
  );
}
