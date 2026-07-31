"use client";

import { useEffect, useState } from "react";
import { MapPin, Plus, Trash2 } from "lucide-react";
import {
  loadAddresses,
  saveAddresses,
  type SavedAddress,
} from "@/lib/account-storage";
import { useToast } from "@/components/ToastProvider";
import { ui } from "@/components/system/tokens";
import { cn } from "@/lib/utils";

const emptyAddress = (): SavedAddress => ({
  id: String(Date.now()),
  name: "Home",
  street: "",
  city: "",
  state: "",
  zip: "",
  country: "Kenya",
  isDefault: false,
});

export default function AccountAddressesPage() {
  const { showToast } = useToast();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setAddresses(loadAddresses());
    setMounted(true);
  }, []);

  const persist = (next: SavedAddress[]) => {
    setAddresses(next);
    saveAddresses(next);
  };

  const add = () => {
    const next = [...addresses, { ...emptyAddress(), isDefault: addresses.length === 0 }];
    persist(next);
    showToast("Address added", "success");
  };

  const update = (id: string, patch: Partial<SavedAddress>) => {
    persist(addresses.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  const remove = (id: string) => {
    persist(addresses.filter((a) => a.id !== id));
    showToast("Address removed", "success");
  };

  const saveAll = () => {
    saveAddresses(addresses);
    showToast("Addresses saved", "success");
  };

  if (!mounted) {
    return <p className="text-[13px] text-[var(--kc-faint)]">Loading…</p>;
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={ui.pageEyebrow}>Account</p>
        <h1 className={`mt-3 ${ui.pageTitle}`}>Addresses</h1>
          <p className={cn("mt-2", ui.pageDesc)}>Saved pickup and billing addresses on this device.</p>
        </div>
        <button type="button" onClick={add} className={cn("inline-flex items-center gap-2", ui.btnPrimary)}>
          <Plus className="h-4 w-4" />
          Add address
        </button>
      </div>

      {addresses.length === 0 ? (
        <section className={cn(ui.panel, "p-10 text-center")}>
          <MapPin className="mx-auto h-10 w-10 text-[var(--kc-line)]" strokeWidth={1.5} />
          <p className="mt-3 text-[13px] text-[var(--kc-mute)]">No addresses saved yet.</p>
          <button type="button" onClick={add} className={cn("mt-4", ui.btnPrimary)}>
            Add your first address
          </button>
        </section>
      ) : (
        <div className="space-y-4">
          {addresses.map((address) => (
            <section key={address.id} className={ui.panel}>
              <div className="flex items-center justify-between border-b border-[var(--kc-line-soft)] px-4 py-3">
                <input
                  value={address.name}
                  onChange={(e) => update(address.id, { name: e.target.value })}
                  className={cn("bg-transparent text-[14px] font-semibold outline-none", ui.input, "border-0 px-0 py-0")}
                  aria-label="Address label"
                />
                <button
                  type="button"
                  onClick={() => remove(address.id)}
                  className="rounded-[var(--kc-radius-sm)] p-2 text-[var(--kc-mute)] hover:bg-[#fcebea] hover:text-[#8e1b0d]"
                  aria-label="Delete address"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-2">
                <Field
                  label="Street"
                  value={address.street}
                  onChange={(v) => update(address.id, { street: v })}
                  className="sm:col-span-2"
                />
                <Field label="City" value={address.city} onChange={(v) => update(address.id, { city: v })} />
                <Field label="County / state" value={address.state} onChange={(v) => update(address.id, { state: v })} />
                <Field label="Postal code" value={address.zip} onChange={(v) => update(address.id, { zip: v })} />
                <Field label="Country" value={address.country} onChange={(v) => update(address.id, { country: v })} />
              </div>
            </section>
          ))}
          <button type="button" onClick={saveAll} className={ui.btnSecondary}>
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
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-[12px] font-medium text-[var(--kc-mute)]">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("w-full", ui.input)}
      />
    </label>
  );
}
