"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  CreditCard,
  Hash,
  Smartphone,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import PhoneField from "@/components/checkout/PhoneField";
import {
  availablePayMethods,
  isMpesaPayMethod,
  type PayMethod,
} from "@/components/checkout/payment-methods";

type Props = {
  open: boolean;
  onClose: () => void;
  payMethod: PayMethod | null;
  onSelect: (method: PayMethod) => void;
  mpesaPhone: string;
  onMpesaPhoneChange: (value: string) => void;
  cardAvailable: boolean;
  mpesaAvailable: boolean;
};

const ICONS: Record<string, React.ReactNode> = {
  stripe_checkout: <Wallet className="h-5 w-5" strokeWidth={1.5} />,
  paystack_card: <CreditCard className="h-5 w-5" strokeWidth={1.5} />,
  mpesa: <Smartphone className="h-5 w-5" strokeWidth={1.5} />,
  paystack_bank: <Building2 className="h-5 w-5" strokeWidth={1.5} />,
  paystack_ussd: <Hash className="h-5 w-5" strokeWidth={1.5} />,
};

/** Bottom-sheet payment chooser — mobile-first, large targets. */
export default function PaymentMethodSheet({
  open,
  onClose,
  payMethod,
  onSelect,
  mpesaPhone,
  onMpesaPhoneChange,
  cardAvailable,
  mpesaAvailable,
}: Props) {
  const [draft, setDraft] = useState<PayMethod | null>(payMethod);
  const [draftPhone, setDraftPhone] = useState(mpesaPhone);
  const methods = availablePayMethods(cardAvailable, mpesaAvailable);

  useEffect(() => {
    if (!open) return;
    setDraft(payMethod);
    setDraftPhone(mpesaPhone);
  }, [open, payMethod, mpesaPhone]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const canConfirm =
    !!draft && (!isMpesaPayMethod(draft) || draftPhone.trim().length >= 9);

  const confirm = () => {
    if (!draft || !canConfirm) return;
    onSelect(draft);
    if (isMpesaPayMethod(draft)) onMpesaPhoneChange(draftPhone);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10050] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/30"
        aria-label="Close payment methods"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pay-sheet-title"
        className="relative z-10 flex max-h-[92dvh] w-full max-w-lg flex-col border border-black/10 bg-[#f7f7f5] shadow-[-8px_0_40px_rgba(0,0,0,0.12)] sm:max-h-[85dvh]"
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-black/15 sm:hidden" />
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-2 pt-4 sm:px-6 sm:pt-6">
          <div className="min-w-0">
            <h2
              id="pay-sheet-title"
              className="text-[20px] font-medium tracking-tight"
            >
              Payment method
            </h2>
            <p className="mt-1 text-[13px] text-black/40">
              Choose how you’ll pay for this order.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-black/45"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 sm:px-6">
          <ul className="mt-4 overflow-hidden border border-black/[0.08] bg-white">
            {methods.map((m, index) => {
              const selected = draft === m.id;
              return (
                <li
                  key={m.id}
                  className={cn(
                    index < methods.length - 1 && "border-b border-black/[0.06]",
                    selected && "bg-[#f7f7f5]",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setDraft(m.id)}
                    className="flex w-full min-h-[4.25rem] items-center gap-3.5 px-4 py-4 text-left"
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
                      <span className="block text-[15px] font-medium">
                        {m.label}
                      </span>
                      <span className="mt-1 block text-[12px] text-black/40">
                        {m.description}
                      </span>
                    </span>
                    <span className="text-black/35">{ICONS[m.id] || null}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          {isMpesaPayMethod(draft) ? (
            <div className="mt-5 border border-black/10 bg-white/50 px-4 py-5">
              <PhoneField
                value={draftPhone}
                onChange={setDraftPhone}
                id="sheet-mpesa-phone"
              />
            </div>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-black/[0.08] px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:px-6">
          <button
            type="button"
            disabled={!canConfirm}
            onClick={confirm}
            className="w-full min-h-12 bg-black text-[12px] font-medium uppercase tracking-[0.16em] text-white disabled:opacity-35"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
