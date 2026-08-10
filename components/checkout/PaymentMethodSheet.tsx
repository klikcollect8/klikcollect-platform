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

/** Full dual-rail payment chooser (legacy sheet; page checkout uses inline list). */
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
        className="absolute inset-0 bg-black/25"
        aria-label="Close payment methods"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pay-sheet-title"
        className="relative z-10 w-full max-w-md border border-black/10 bg-[#f7f7f5] p-6 shadow-xl sm:rounded-sm"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="pay-sheet-title" className="text-[17px] font-medium">
            Payment method
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
        <ul className="mt-5 space-y-2">
          {methods.map((m) => {
            const selected = draft === m.id;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setDraft(m.id)}
                  className={cn(
                    "flex w-full items-center gap-3 border px-4 py-3 text-left",
                    selected ? "border-black bg-white" : "border-black/10",
                  )}
                >
                  <span className="text-black/60">{ICONS[m.id] || null}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium">
                      {m.label}
                    </span>
                    <span className="block text-[12px] text-black/40">
                      {m.description}
                    </span>
                  </span>
                  {selected ? (
                    <span className="text-[11px] uppercase tracking-[0.14em]">
                      On
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
        {isMpesaPayMethod(draft) ? (
          <label className="mt-5 block">
            <span className="text-[12px] text-black/40">M-Pesa number</span>
            <input
              value={draftPhone}
              onChange={(e) => setDraftPhone(e.target.value)}
              className="mt-2 w-full border-b border-black/15 bg-transparent py-3 text-[16px] outline-none focus:border-black"
              placeholder="07…"
              inputMode="tel"
            />
          </label>
        ) : null}
        <button
          type="button"
          disabled={!canConfirm}
          onClick={confirm}
          className="mt-6 w-full bg-black py-3.5 text-[12px] font-medium uppercase tracking-[0.16em] text-white disabled:opacity-35"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}
