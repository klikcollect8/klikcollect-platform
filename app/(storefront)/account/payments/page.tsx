"use client";

import { useEffect, useState } from "react";
import { CreditCard, Plus, Trash2 } from "lucide-react";
import {
  loadPayments,
  savePayments,
  type SavedPayment,
} from "@/lib/account-storage";
import { useToast } from "@/components/ToastProvider";
import { ui } from "@/components/system/tokens";
import { cn } from "@/lib/utils";

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
    return <p className="text-[13px] text-[var(--kc-faint)]">Loading…</p>;
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={ui.pageEyebrow}>Account</p>
        <h1 className={`mt-3 ${ui.pageTitle}`}>Payments</h1>
          <p className={cn("mt-2", ui.pageDesc)}>
            Reference cards for checkout — stored locally until Stripe vaulting ships.
          </p>
        </div>
        <button type="button" onClick={add} className={cn("inline-flex items-center gap-2", ui.btnPrimary)}>
          <Plus className="h-4 w-4" />
          Add method
        </button>
      </div>

      {methods.length === 0 ? (
        <section className={cn(ui.panel, "p-10 text-center")}>
          <CreditCard className="mx-auto h-10 w-10 text-[var(--kc-line)]" strokeWidth={1.5} />
          <p className="mt-3 text-[13px] text-[var(--kc-mute)]">No payment methods saved.</p>
          <button type="button" onClick={add} className={cn("mt-4", ui.btnPrimary)}>
            Add a card
          </button>
        </section>
      ) : (
        <div className="space-y-4">
          {methods.map((method) => (
            <section key={method.id} className={ui.panel}>
              <div className="flex items-center justify-between border-b border-[var(--kc-line-soft)] px-4 py-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-[var(--kc-mute)]" />
                  <span className="text-[14px] font-semibold text-[var(--kc-ink)]">{method.brand}</span>
                </div>
                <button
                  type="button"
                  onClick={() => remove(method.id)}
                  className="rounded-[var(--kc-radius-sm)] p-2 text-[var(--kc-mute)] hover:bg-[#fcebea] hover:text-[#8e1b0d]"
                  aria-label="Remove payment method"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-2">
                <Field label="Brand" value={method.brand} onChange={(v) => update(method.id, { brand: v })} />
                <Field
                  label="Last 4 digits"
                  value={method.last4}
                  onChange={(v) => update(method.id, { last4: v.replace(/\D/g, "").slice(0, 4) })}
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
            </section>
          ))}
          <button
            type="button"
            onClick={() => {
              savePayments(methods);
              showToast("Payment methods saved", "success");
            }}
            className={ui.btnSecondary}
          >
            Save changes
          </button>
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
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-[var(--kc-mute)]">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className={cn("w-full", ui.input)} />
    </label>
  );
}
