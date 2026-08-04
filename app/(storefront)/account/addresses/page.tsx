"use client";

import { useEffect, useState } from "react";
import {
  loadAddresses,
  saveAddresses,
  type SavedAddress,
} from "@/lib/account-storage";
import { useToast } from "@/components/ToastProvider";
import { useIsClient } from "@/lib/hooks/useIsClient";

const fieldClass =
  "h-auto w-full border-0 border-b border-black/15 bg-transparent px-0 py-3 text-[15px] text-black outline-none placeholder:text-black/30 focus:border-black/50";
const labelClass =
  "text-[11px] font-medium uppercase tracking-[0.18em] text-black/35";

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
  const mounted = useIsClient();

  useEffect(() => {
    setAddresses(loadAddresses());
  }, []);

  const persist = (next: SavedAddress[]) => {
    setAddresses(next);
    saveAddresses(next);
  };

  const add = () => {
    const next = [
      ...addresses,
      { ...emptyAddress(), isDefault: addresses.length === 0 },
    ];
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
    return <p className="text-[14px] text-black/35">Loading…</p>;
  }

  return (
    <div className="space-y-10 text-left">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-black/35">
          Addresses
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-black/45">
          Saved pickup and billing addresses on this device.
        </p>
      </div>

      {addresses.length === 0 ? (
        <div>
          <p className="text-[14px] text-black/40">No addresses saved yet.</p>
          <button
            type="button"
            onClick={add}
            className="mt-6 flex h-12 w-full items-center justify-center bg-black text-[12px] font-medium uppercase tracking-[0.14em] text-white transition-opacity hover:opacity-80"
          >
            Add address
          </button>
        </div>
      ) : (
        <div className="space-y-10">
          {addresses.map((address, index) => (
            <section key={address.id} className="space-y-0">
              <div className="flex h-12 items-center justify-between border-b border-black/[0.08]">
                <input
                  value={address.name}
                  onChange={(e) => update(address.id, { name: e.target.value })}
                  className="bg-transparent text-[15px] font-medium text-black outline-none"
                  aria-label="Address label"
                />
                <button
                  type="button"
                  onClick={() => remove(address.id)}
                  className="text-[11px] uppercase tracking-[0.14em] text-black/25 transition-colors hover:text-black"
                  aria-label="Delete address"
                >
                  Remove
                </button>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field
                  label="Street"
                  value={address.street}
                  onChange={(v) => update(address.id, { street: v })}
                  className="sm:col-span-2"
                />
                <Field
                  label="City"
                  value={address.city}
                  onChange={(v) => update(address.id, { city: v })}
                />
                <Field
                  label="County / state"
                  value={address.state}
                  onChange={(v) => update(address.id, { state: v })}
                />
                <Field
                  label="Postal code"
                  value={address.zip}
                  onChange={(v) => update(address.id, { zip: v })}
                />
                <Field
                  label="Country"
                  value={address.country}
                  onChange={(v) => update(address.id, { country: v })}
                />
              </div>
              {index < addresses.length - 1 ? (
                <div className="mt-8 border-b border-black/[0.08]" />
              ) : null}
            </section>
          ))}

          <div className="space-y-3">
            <button
              type="button"
              onClick={saveAll}
              className="flex h-12 w-full items-center justify-center bg-black text-[12px] font-medium uppercase tracking-[0.14em] text-white transition-opacity hover:opacity-80"
            >
              Save changes
            </button>
            <button
              type="button"
              onClick={add}
              className="flex h-12 w-full items-center justify-center border border-black/15 text-[12px] font-medium uppercase tracking-[0.14em] text-black transition-colors hover:border-black"
            >
              Add address
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
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <label className={`block text-left ${className ?? ""}`}>
      <span className={labelClass}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={fieldClass}
      />
    </label>
  );
}
