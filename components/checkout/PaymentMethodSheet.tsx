"use client";

import { useEffect, useState } from "react";
import { Check, CreditCard, Smartphone, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { type PayMethod, isMpesaPayMethod } from "@/components/checkout/payment-methods";

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

/** Minimal Card / M-Pesa chooser. */
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
    !!draft &&
    (!isMpesaPayMethod(draft) || draftPhone.trim().length >= 9);

  const confirm = () => {
    if (!draft || !canConfirm) return;
    onSelect(draft);
    if (isMpesaPayMethod(draft)) onMpesaPhoneChange(draftPhone);
    onClose();
  };

  if (!open) return null;

  const options: Array<{
    id: PayMethod;
    label: string;
    hint: string;
    show: boolean;
    icon: React.ReactNode;
  }> = [
    {
      id: "stripe_card",
      label: "Card",
      hint: "Visa, Mastercard",
      show: cardAvailable,
      icon: <CreditCard className="h-5 w-5" strokeWidth={1.5} />,
    },
    {
      id: "mpesa",
      label: "M-Pesa",
      hint: "Safaricom STK push",
      show: mpesaAvailable,
      icon: <Smartphone className="h-5 w-5" strokeWidth={1.5} />,
    },
  ];

  return (
    <div className="fixed inset-0 z-[10050] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/25"
        aria-label="Close payment methods"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pay-sheet-title"
        className="relative z-10 flex w-full max-w-[400px] flex-col bg-[#f7f7f5] max-h-[85dvh] sm:border sm:border-black/8"
      >
        <div className="flex items-center justify-between px-6 pb-2 pt-5">
          <h2
            id="pay-sheet-title"
            className="text-[16px] font-medium tracking-tight"
          >
            Payment
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center text-black/45"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        <div className="space-y-1 px-4 pb-4">
          {options
            .filter((o) => o.show)
            .map((o) => {
              const selected = draft === o.id;
              return (
                <div key={o.id}>
                  <button
                    type="button"
                    onClick={() => setDraft(o.id)}
                    className={cn(
                      "flex w-full items-center gap-4 px-3 py-4 text-left transition-colors",
                      selected ? "bg-black/[0.04]" : "hover:bg-black/[0.03]",
                    )}
                  >
                    <span className="text-black/50">{o.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-medium">
                        {o.label}
                      </span>
                      <span className="mt-0.5 block text-[12px] text-black/40">
                        {o.hint}
                      </span>
                    </span>
                    {selected ? (
                      <Check className="h-4 w-4" strokeWidth={2} />
                    ) : null}
                  </button>
                  {selected && o.id === "mpesa" ? (
                    <div className="px-3 pb-4">
                      <input
                        value={draftPhone}
                        onChange={(e) => setDraftPhone(e.target.value)}
                        placeholder="07XXXXXXXX"
                        inputMode="tel"
                        autoComplete="tel"
                        className="w-full border-b border-black/15 bg-transparent py-3 text-[15px] outline-none focus:border-black/40"
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}

          {!cardAvailable && !mpesaAvailable ? (
            <p className="px-3 py-10 text-center text-[14px] text-black/40">
              Payments unavailable
            </p>
          ) : null}
        </div>

        <div className="px-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] pt-2">
          <button
            type="button"
            onClick={confirm}
            disabled={!canConfirm}
            className="w-full bg-black py-3.5 text-[13px] font-medium uppercase tracking-[0.16em] text-white disabled:bg-black/25"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export type { PayMethod };
