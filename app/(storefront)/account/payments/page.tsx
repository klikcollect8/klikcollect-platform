"use client";

import { useEffect, useState } from "react";
import {
  loadPayments,
  savePayments,
  type SavedPayment,
} from "@/lib/account-storage";
import { useToast } from "@/components/ToastProvider";

const fieldClass =
  "h-auto w-full border-0 border-b border-black/15 bg-transparent px-0 py-3 text-[15px] text-black outline-none placeholder:text-black/30 focus:border-black/50";
const labelClass =
  "text-[11px] font-medium uppercase tracking-[0.18em] text-black/35";

const emptyPayment = (): SavedPayment => ({
  id: String(Date.now()),
  type: "card",
  last4: "",
  brand: "Visa",
  expiryMonth: "",
  expiryYear: "",
  isDefault: false,
});

export default function AccountPaymentsPage() {
  const { showToast } = useToast();
  const [methods, setMethods] = useState<SavedPayment[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMethods(loadPayments());
    setMounted(true);
  }, []);

  const persist = (next: SavedPayment[]) => {
    setMethods(next);
    savePayments(next);
  };

  const add = () => {
    persist([...methods, { ...emptyPayment(), isDefault: methods.length === 0 }]);
    showToast("Payment method added (local only)", "success");
  };

  const update = (id: string, patch: Partial<SavedPayment>) => {
    persist(methods.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const remove = (id: string) => {
    persist(methods.filter((m) => m.id !== id));
    showToast("Payment method removed", "success");
  };

  if (!mounted) {
    return <p className="text-[14px] text-black/35">Loading…</p>;
  }

  return (
    <div className="space-y-10 text-left">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-black/35">
          Payments
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-black/45">
          Reference cards for checkout — stored locally until Stripe vaulting ships.
        </p>
      </div>

      {methods.length === 0 ? (
        <div>
          <p className="text-[14px] text-black/40">No payment methods saved.</p>
          <button
            type="button"
            onClick={add}
            className="mt-6 flex h-12 w-full items-center justify-center bg-black text-[12px] font-medium uppercase tracking-[0.14em] text-white transition-opacity hover:opacity-80"
          >
            Add a card
          </button>
        </div>
      ) : (
        <div className="space-y-10">
          {methods.map((method, index) => (
            <section key={method.id} className="space-y-0">
              <div className="flex h-12 items-center justify-between border-b border-black/[0.08]">
                <span className="text-[15px] font-medium text-black">
                  {method.brand || "Card"}
                  {method.last4 ? ` ···· ${method.last4}` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => remove(method.id)}
                  className="text-[11px] uppercase tracking-[0.14em] text-black/25 transition-colors hover:text-black"
                  aria-label="Remove payment method"
                >
                  Remove
                </button>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field
                  label="Brand"
                  value={method.brand}
                  onChange={(v) => update(method.id, { brand: v })}
                />
                <Field
                  label="Last 4 digits"
                  value={method.last4}
                  onChange={(v) =>
                    update(method.id, { last4: v.replace(/\D/g, "").slice(0, 4) })
                  }
                />
                <Field
                  label="Expiry month"
                  value={method.expiryMonth}
                  onChange={(v) => update(method.id, { expiryMonth: v })}
                />
                <Field
                  label="Expiry year"
                  value={method.expiryYear}
                  onChange={(v) => update(method.id, { expiryYear: v })}
                />
              </div>
              {index < methods.length - 1 ? (
                <div className="mt-8 border-b border-black/[0.08]" />
              ) : null}
            </section>
          ))}

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                savePayments(methods);
                showToast("Payment methods saved", "success");
              }}
              className="flex h-12 w-full items-center justify-center bg-black text-[12px] font-medium uppercase tracking-[0.14em] text-white transition-opacity hover:opacity-80"
            >
              Save changes
            </button>
            <button
              type="button"
              onClick={add}
              className="flex h-12 w-full items-center justify-center border border-black/15 text-[12px] font-medium uppercase tracking-[0.14em] text-black transition-colors hover:border-black"
            >
              Add method
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-left">
      <span className={labelClass}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={fieldClass}
      />
    </label>
  );
}
