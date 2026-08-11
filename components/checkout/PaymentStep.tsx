"use client";

import {
  Building2,
  CreditCard,
  Hash,
  Lock,
  Smartphone,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/currency";
import PhoneField from "@/components/checkout/PhoneField";
import {
  availablePayMethods,
  isMpesaPayMethod,
  isPaystackHostedMethod,
  isStripePayMethod,
  type PayMethod,
  type PayMethodMeta,
} from "@/components/checkout/payment-methods";

type Props = {
  payMethod: PayMethod | null;
  onSelect: (method: PayMethod) => void;
  mpesaPhone: string;
  onMpesaPhoneChange: (value: string) => void;
  customerPhone: string;
  stripeReady: boolean;
  paystackReady: boolean;
  paymentsAvailable: boolean;
  configError?: string | null;
  grandTotal: number;
  itemCount: number;
};

const ICONS: Record<string, React.ReactNode> = {
  stripe_checkout: <Wallet className="h-5 w-5" strokeWidth={1.5} />,
  paystack_card: <CreditCard className="h-5 w-5" strokeWidth={1.5} />,
  mpesa: <Smartphone className="h-5 w-5" strokeWidth={1.5} />,
  paystack_bank: <Building2 className="h-5 w-5" strokeWidth={1.5} />,
  paystack_ussd: <Hash className="h-5 w-5" strokeWidth={1.5} />,
};

const GROUPS: { id: "paystack" | "stripe"; label: string; hint: string }[] = [
  {
    id: "paystack",
    label: "Pay in Kenya",
    hint: "M-Pesa, local cards & bank transfer",
  },
  {
    id: "stripe",
    label: "International",
    hint: "Cards & digital wallets",
  },
];

/**
 * Mobile-first payment picker — spaced groups, large targets, clear hierarchy.
 * Pattern refs: Swiggy / DoorDash / GetYourGuide payment lists (structure only).
 */
export default function PaymentStep({
  payMethod,
  onSelect,
  mpesaPhone,
  onMpesaPhoneChange,
  customerPhone,
  stripeReady,
  paystackReady,
  paymentsAvailable,
  configError,
  grandTotal,
  itemCount,
}: Props) {
  const methods = availablePayMethods(stripeReady, paystackReady);

  return (
    <div className="space-y-8 sm:space-y-10">
      <header className="space-y-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-black/35">
          Payment
        </p>
        <h2 className="max-w-[16ch] text-[clamp(1.75rem,6vw,2.25rem)] font-medium leading-[1.08] tracking-[-0.03em] text-black">
          How do you want to pay?
        </h2>
        <p className="text-[14px] leading-relaxed text-black/45 sm:text-[15px]">
          {itemCount} {itemCount === 1 ? "item" : "items"} · Total{" "}
          <span className="font-medium tabular-nums text-black">
            {formatPrice(grandTotal)}
          </span>
        </p>
        <p className="inline-flex items-center gap-2 text-[12px] text-black/40">
          <Lock className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          Payments are secure and encrypted
        </p>
      </header>

      {!paymentsAvailable ? (
        <div className="border border-black/10 bg-white/60 px-5 py-6 sm:px-6">
          <p className="text-[15px] text-black/50">
            {configError || "Payments are unavailable right now."}
          </p>
        </div>
      ) : (
        <div className="space-y-7 sm:space-y-8">
          {GROUPS.map((group) => {
            const groupMethods = methods.filter((m) => m.group === group.id);
            if (!groupMethods.length) return null;
            return (
              <section key={group.id} className="space-y-3">
                <div className="px-0.5">
                  <h3 className="text-[13px] font-semibold tracking-tight text-black">
                    {group.label}
                  </h3>
                  <p className="mt-1 text-[12px] text-black/40">{group.hint}</p>
                </div>

                <ul className="overflow-hidden border border-black/[0.08] bg-white">
                  {groupMethods.map((m, index) => (
                    <MethodRow
                      key={m.id}
                      method={m}
                      selected={payMethod === m.id}
                      showDivider={index < groupMethods.length - 1}
                      onSelect={() => onSelect(m.id)}
                    />
                  ))}
                </ul>

                {group.id === "paystack" && isMpesaPayMethod(payMethod) ? (
                  <div className="border border-black/10 bg-[#f7f7f5] px-4 py-5 sm:px-5 sm:py-6">
                    <p className="text-[13px] font-medium text-black">
                      M-Pesa number
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-black/40">
                      We’ll send an STK push to this phone. Approve it to finish
                      payment.
                    </p>
                    <div className="mt-5">
                      <PhoneField
                        value={mpesaPhone || customerPhone}
                        onChange={onMpesaPhoneChange}
                        id="mpesaPhone"
                      />
                    </div>
                  </div>
                ) : null}
              </section>
            );
          })}

          {isStripePayMethod(payMethod) ? (
            <p className="rounded-none border border-dashed border-black/15 px-4 py-4 text-[13px] leading-relaxed text-black/45 sm:px-5">
              Next you’ll open Stripe Checkout — card, Apple Pay, Google Pay, or
              Link when available.
            </p>
          ) : null}
          {isPaystackHostedMethod(payMethod) ? (
            <p className="rounded-none border border-dashed border-black/15 px-4 py-4 text-[13px] leading-relaxed text-black/45 sm:px-5">
              Next you’ll finish on Paystack’s secure page for this method.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function MethodRow({
  method,
  selected,
  showDivider,
  onSelect,
}: {
  method: PayMethodMeta;
  selected: boolean;
  showDivider: boolean;
  onSelect: () => void;
}) {
  return (
    <li
      className={cn(
        showDivider && "border-b border-black/[0.06]",
        selected && "bg-[#f7f7f5]",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="flex w-full min-h-[4.25rem] items-center gap-3.5 px-4 py-4 text-left transition-colors sm:min-h-[4.5rem] sm:gap-4 sm:px-5 sm:py-5"
      >
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
            selected ? "border-black bg-black" : "border-black/25",
          )}
          aria-hidden
        >
          {selected ? (
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
          ) : null}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium tracking-tight text-black sm:text-[16px]">
            {method.label}
          </span>
          <span className="mt-1 block text-[12px] leading-snug text-black/40 sm:text-[13px]">
            {method.description}
          </span>
        </span>

        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center",
            selected ? "text-black" : "text-black/35",
          )}
          aria-hidden
        >
          {ICONS[method.id] || null}
        </span>
      </button>
    </li>
  );
}
