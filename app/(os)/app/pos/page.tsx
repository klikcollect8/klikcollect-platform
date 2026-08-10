"use client";

import { useCallback, useEffect, useState } from "react";
import { Show, SignInButton, useUser } from "@clerk/nextjs";
import { ModuleShell } from "@/components/os/ModuleShell";
import { PrintSheet, printSheet } from "@/components/os/PrintSheet";
import { osUi } from "@/components/os/os-ui";
import { formatKesMinor } from "@/lib/money";
import { ScanBarcode, Trash2, Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type Line = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  moneyMinor: number;
  available: number;
  barcode?: string;
};

type Receipt = {
  code: string;
  totalMinor: number;
  currency: string;
  items: Array<{ name: string; quantity: number; moneyMinor: number }>;
  note: string;
  tender?: string;
};

type Tender = "cash" | "mpesa" | "card";

export default function PosPage() {
  const { user } = useUser();
  const [vendorId, setVendorId] = useState("");
  const [scan, setScan] = useState("");
  const [cart, setCart] = useState<Line[]>([]);
  const [tender, setTender] = useState<Tender>("cash");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [canPrint, setCanPrint] = useState(false);
  const [permsLoaded, setPermsLoaded] = useState(false);
  const [storeName, setStoreName] = useState("Store");

  useEffect(() => {
    void fetch("/api/os/me")
      .then((r) => r.json())
      .then((b) => {
        setVendorId(b?.data?.vendorIds?.[0] || "");
        const perms: string[] = b?.data?.permissions || [];
        setCanPrint(perms.includes("pos:print_receipt"));
        setPermsLoaded(true);
      })
      .catch(() => setPermsLoaded(true));
    void fetch("/api/os/dashboard")
      .then((r) => r.json())
      .then((b) => {
        if (b?.data?.storeName) setStoreName(String(b.data.storeName));
      })
      .catch(() => null);
  }, []);

  const totalMinor = cart.reduce((s, l) => s + l.moneyMinor * l.quantity, 0);

  const addProduct = useCallback(
    (p: {
      id: string;
      name: string;
      price: number;
      moneyMinor?: number;
      available?: number;
      stock?: number;
      barcode?: string;
    }) => {
      const available = p.available ?? p.stock ?? 0;
      if (available <= 0) {
        setMessage(`${p.name} is out of stock`);
        return;
      }
      setCart((prev) => {
        const idx = prev.findIndex((l) => l.productId === p.id);
        if (idx >= 0) {
          const next = [...prev];
          const q = next[idx].quantity + 1;
          if (q > available) {
            setMessage(`Only ${available} available`);
            return prev;
          }
          next[idx] = { ...next[idx], quantity: q };
          return next;
        }
        return [
          ...prev,
          {
            productId: p.id,
            name: p.name,
            quantity: 1,
            unitPrice: p.price,
            moneyMinor: p.moneyMinor ?? Math.round(p.price * 100),
            available,
            barcode: p.barcode,
          },
        ];
      });
      setMessage(null);
    },
    [],
  );

  async function lookupBarcode(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/os/barcode?code=${encodeURIComponent(trimmed)}`,
      );
      const json = await res.json();
      if (!res.ok) {
        setMessage(json?.error?.message || "Barcode not found");
        return;
      }
      addProduct(json.data);
      setScan("");
    } finally {
      setBusy(false);
    }
  }

  async function completeSale() {
    if (!cart.length || !vendorId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/os/pos/sale", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `pos-${user?.id || "anon"}-${Date.now()}`,
        },
        body: JSON.stringify({
          vendorId,
          tender,
          customerName: customerName.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          customerEmail: customerEmail.trim() || undefined,
          items: cart.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json?.error?.message || "Sale failed");
        return;
      }
      setReceipt(json.receipt);
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerEmail("");
      setMessage(null);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && document.activeElement?.id === "pos-scan") {
        e.preventDefault();
        void lookupBarcode(scan);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scan]);

  return (
    <ModuleShell
      title="Point of sale"
      description="Scan, choose tender (cash / M-Pesa / card), sell against shared inventory."
      live
    >
      <Show when="signed-out">
        <div className="mb-4 flex items-center justify-between border-b border-black/10 py-3 text-[13px]">
          <span className={osUi.muted}>
            Sign in as a vendor operator to sell
          </span>
          <SignInButton mode="redirect">
            <button type="button" className={osUi.btnPrimary}>
              Sign in
            </button>
          </SignInButton>
        </div>
      </Show>

      {message ? (
        <p className={cn("mb-3 text-[13px]", osUi.danger)}>{message}</p>
      ) : null}

      {receipt ? (
        <div className="mb-4 border-b border-black/10 pb-4">
          <PrintSheet
            template="pos"
            vendorName={storeName}
            receiptCode={receipt.code}
            tender={receipt.tender}
            notes={receipt.note}
            totalMinor={receipt.totalMinor}
            lines={receipt.items.map((it) => ({
              name: it.name,
              quantity: it.quantity,
              moneyMinor: it.moneyMinor,
            }))}
          />
          <div className="mt-3 flex flex-wrap gap-2 print:hidden">
            {permsLoaded && canPrint ? (
              <button
                type="button"
                onClick={() => printSheet()}
                className={osUi.btnSecondary}
              >
                Print
              </button>
            ) : permsLoaded ? (
              <p className={cn("text-[12px]", osUi.muted)}>
                Printing requires pos:print_receipt
              </p>
            ) : (
              <p className={cn("text-[12px]", osUi.muted)}>Checking print access…</p>
            )}
            <button
              type="button"
              onClick={() => setReceipt(null)}
              className={osUi.btnGhost}
            >
              New sale
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void lookupBarcode(scan);
            }}
            className="flex gap-2"
          >
            <div className="flex flex-1 items-center gap-2 border-b border-black/15">
              <ScanBarcode className="h-4 w-4 text-black/35" />
              <input
                id="pos-scan"
                value={scan}
                onChange={(e) => setScan(e.target.value)}
                placeholder="Scan or type GTIN / barcode…"
                className="h-10 w-full text-[14px] outline-none"
                autoComplete="off"
              />
            </div>
            <button
              type="submit"
              disabled={busy || !scan.trim()}
              className={osUi.btnPrimary}
            >
              Add
            </button>
          </form>

          <div className="overflow-hidden">
            <table className="w-full text-left text-[13px]">
              <thead
                className={cn(
                  "border-b border-black/10 text-[12px]",
                  osUi.muted,
                )}
              >
                <tr>
                  <th className="px-1 py-2.5 font-medium">Item</th>
                  <th className="px-1 py-2.5 font-medium">Qty</th>
                  <th className="px-1 py-2.5 font-medium">Line</th>
                  <th className="px-1 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06]">
                {cart.map((l) => (
                  <tr key={l.productId}>
                    <td className="px-1 py-3">
                      <p className="font-medium text-black">{l.name}</p>
                      {l.barcode ? (
                        <p className={cn("text-[11px]", osUi.muted)}>
                          {l.barcode}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-1 py-3">
                      <div className="inline-flex items-center border border-black/15">
                        <button
                          type="button"
                          className="px-2 py-1"
                          onClick={() =>
                            setCart((prev) =>
                              prev
                                .map((x) =>
                                  x.productId === l.productId
                                    ? { ...x, quantity: x.quantity - 1 }
                                    : x,
                                )
                                .filter((x) => x.quantity > 0),
                            )
                          }
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-8 text-center tabular-nums">
                          {l.quantity}
                        </span>
                        <button
                          type="button"
                          className="px-2 py-1"
                          onClick={() =>
                            setCart((prev) =>
                              prev.map((x) =>
                                x.productId === l.productId &&
                                x.quantity < x.available
                                  ? { ...x, quantity: x.quantity + 1 }
                                  : x,
                              ),
                            )
                          }
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="px-1 py-3 tabular-nums">
                      {formatKesMinor(l.moneyMinor * l.quantity)}
                    </td>
                    <td className="px-1 py-3 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setCart((prev) =>
                            prev.filter((x) => x.productId !== l.productId),
                          )
                        }
                        className="text-black/35 hover:text-[#8e1b0d]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!cart.length ? (
              <p
                className={cn("px-1 py-10 text-center text-[13px]", osUi.muted)}
              >
                Scan a barcode to start a sale
              </p>
            ) : null}
          </div>
        </div>

        <aside className="h-fit border-t border-black/10 pt-5 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <p className={osUi.sectionLabel}>Sale total</p>
          <p className="mt-2 text-[28px] font-semibold tabular-nums text-black">
            {formatKesMinor(totalMinor)}
          </p>

          <p className={cn("mt-5", osUi.sectionLabel)}>Customer (optional)</p>
          <div className="mt-2 space-y-2">
            <input
              className={osUi.input}
              placeholder="Name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
            <input
              className={osUi.input}
              placeholder="Phone"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
            <input
              className={osUi.input}
              placeholder="Email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
            />
          </div>

          <p className={cn("mt-5", osUi.sectionLabel)}>Tender</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["cash", "mpesa", "card"] as Tender[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTender(t)}
                className={cn(
                  "min-w-[72px] px-3 py-2 text-[12px] font-medium uppercase tracking-[0.12em]",
                  tender === t
                    ? "bg-black text-white"
                    : "border border-black/20 text-black hover:border-black",
                )}
              >
                {t === "mpesa" ? "M-Pesa" : t}
              </button>
            ))}
          </div>

          <p className={cn("mt-3 text-[12px]", osUi.muted)}>
            {vendorId ? `Vendor ${vendorId}` : "Loading vendor membership…"}
          </p>

          <Show when="signed-in">
            <button
              type="button"
              disabled={busy || !cart.length || !vendorId}
              onClick={() => void completeSale()}
              className={cn(osUi.btnPrimary, "mt-5 w-full py-3 text-[13px]")}
            >
              {busy ? "Completing…" : `Complete · ${tender}`}
            </button>
          </Show>
        </aside>
      </div>
    </ModuleShell>
  );
}
