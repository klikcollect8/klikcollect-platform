"use client";

import { useCallback, useEffect, useState } from "react";
import { Show, useUser } from "@clerk/nextjs";
import AuthModalTrigger from "@/components/auth/AuthModalTrigger";
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
          <AuthModalTrigger redirect="/app/pos" className={osUi.btnPrimary}>
            Sign in
          </AuthModalTrigger>
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

      <div className="grid gap-8 pb-28 lg:grid-cols-[1fr_320px] lg:pb-0">
        <div className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void lookupBarcode(scan);
            }}
            className="flex gap-2"
          >
            <div className="flex min-h-12 flex-1 items-center gap-2 border-b border-black/15">
              <ScanBarcode className="h-5 w-5 shrink-0 text-black/35" />
              <input
                id="pos-scan"
                value={scan}
                onChange={(e) => setScan(e.target.value)}
                placeholder="Scan or type barcode…"
                className="h-12 w-full text-[16px] outline-none"
                autoComplete="off"
              />
            </div>
            <button
              type="submit"
              disabled={busy || !scan.trim()}
              className={cn(osUi.btnPrimary, "min-h-12")}
            >
              Add
            </button>
          </form>

          <div className="divide-y divide-black/10 border-y border-black/10">
            {cart.map((l) => (
              <div
                key={l.productId}
                className="flex flex-wrap items-center gap-3 py-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium text-black">{l.name}</p>
                  {l.barcode ? (
                    <p className={cn("text-[12px]", osUi.muted)}>{l.barcode}</p>
                  ) : null}
                  <p className="mt-1 text-[13px] tabular-nums text-black/50">
                    {formatKesMinor(l.moneyMinor * l.quantity)}
                  </p>
                </div>
                <div className="inline-flex items-center border border-black/15">
                  <button
                    type="button"
                    className="flex h-11 w-11 items-center justify-center"
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
                    aria-label="Decrease"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-10 text-center text-[15px] tabular-nums">
                    {l.quantity}
                  </span>
                  <button
                    type="button"
                    className="flex h-11 w-11 items-center justify-center"
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
                    aria-label="Increase"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setCart((prev) =>
                      prev.filter((x) => x.productId !== l.productId),
                    )
                  }
                  className="flex h-11 w-11 items-center justify-center text-black/35 hover:text-[#8e1b0d]"
                  aria-label="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          {!cart.length ? (
            <p className={cn("py-12 text-center text-[14px]", osUi.muted)}>
              Scan a barcode to start a sale
            </p>
          ) : null}
        </div>

        <aside className="space-y-5 border-t border-black/10 pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <div>
            <p className={osUi.sectionLabel}>Sale total</p>
            <p className="mt-2 text-[28px] font-medium tabular-nums text-black">
              {formatKesMinor(totalMinor)}
            </p>
          </div>

          <div>
            <p className={osUi.sectionLabel}>Customer (optional)</p>
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
          </div>

          <div>
            <p className={osUi.sectionLabel}>Tender</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["cash", "mpesa", "card"] as Tender[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTender(t)}
                  className={cn(
                    "min-h-11 min-w-[72px] px-3 text-[12px] font-medium uppercase tracking-[0.12em]",
                    tender === t
                      ? "bg-black text-white"
                      : "border border-black/20 text-black hover:border-black",
                  )}
                >
                  {t === "mpesa" ? "M-Pesa" : t}
                </button>
              ))}
            </div>
          </div>

          <Show when="signed-in">
            <button
              type="button"
              disabled={busy || !cart.length || !vendorId}
              onClick={() => void completeSale()}
              className={cn(
                osUi.btnPrimary,
                "hidden min-h-12 w-full lg:inline-flex",
              )}
            >
              {busy ? "Completing…" : `Complete · ${tender}`}
            </button>
          </Show>
        </aside>
      </div>

      <Show when="signed-in">
        {!receipt ? (
          <div className="fixed inset-x-0 bottom-14 z-30 border-t border-black/10 bg-[var(--kc-canvas)] px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] lg:hidden">
            <button
              type="button"
              disabled={busy || !cart.length || !vendorId}
              onClick={() => void completeSale()}
              className={cn(osUi.btnPrimary, "min-h-12 w-full")}
            >
              {busy
                ? "Completing…"
                : `Complete · ${formatKesMinor(totalMinor)} · ${tender}`}
            </button>
          </div>
        ) : null}
      </Show>
    </ModuleShell>
  );
}
