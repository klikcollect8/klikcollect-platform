"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Show } from "@clerk/nextjs";
import { ArrowLeft } from "lucide-react";
import AuthModalTrigger from "@/components/auth/AuthModalTrigger";
import { formatKesMajor } from "@/lib/money";
import { StatusBadge } from "@/components/os/StatusBadge";
import { osUi } from "@/components/os/os-ui";
import { cn } from "@/lib/utils";
import { useTableRealtime } from "@/lib/hooks/useTableRealtime";

type Order = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  collectHub: string;
  status: string;
  items: Array<{ name: string; quantity: number; unitPrice: number }>;
  total: number;
  notes?: string;
  createdAt: string;
  receiptPublicId?: string | null;
  snapshot?: { storePublicId?: string; storeName?: string };
};

type Branch = {
  id: string;
  public_id: string;
  name: string;
};

const NEXT: Record<string, string | null> = {
  pending: "confirmed",
  confirmed: "preparing",
  preparing: "ready",
  ready: "collected",
  collected: null,
  cancelled: null,
};

const FLOW = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "collected",
] as const;

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = decodeURIComponent(String(params?.id || ""));
  const [order, setOrder] = useState<Order | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [assignMsg, setAssignMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/os/orders");
    const json = await res.json();
    const list = (json.data || []) as Order[];
    const found = list.find((o) => o.id === orderId) || null;
    setOrder(found);
    setMissing(!found);
    if (found) {
      setBranchId(found.snapshot?.storePublicId || "");
    }
  }, [orderId]);

  useTableRealtime({
    channelName: `os-order-${orderId}`,
    table: "orders",
    onEvent: () => void load(),
  });

  useEffect(() => {
    void load();
    void fetch("/api/os/me")
      .then((r) => r.json())
      .then(async (me) => {
        const vid = me?.data?.vendorIds?.[0] || "";
        if (!vid) return;
        const bRes = await fetch(
          `/api/os/branches?vendorId=${encodeURIComponent(vid)}`,
        ).then((r) => r.json());
        setBranches(bRes?.data || []);
      });
  }, [load]);

  async function advance(status: string) {
    if (!order) return;
    setBusy(true);
    setAssignMsg(null);
    try {
      const res = await fetch("/api/os/orders", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `os-order-${order.id}-${status}-${Date.now()}`,
        },
        body: JSON.stringify({ id: order.id, status }),
      });
      const json = await res.json();
      if (res.ok) await load();
      else alert(json?.error?.message || "Transition rejected");
    } finally {
      setBusy(false);
    }
  }

  async function assignBranch() {
    if (!order || !branchId) return;
    const branch = branches.find((b) => b.public_id === branchId);
    if (!branch) return;
    setBusy(true);
    setAssignMsg(null);
    try {
      const res = await fetch("/api/os/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: order.id,
          storeId: branch.public_id,
          storeName: branch.name,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAssignMsg(json?.error?.message || "Branch assign failed");
        return;
      }
      setAssignMsg(`Branch · ${branch.name}`);
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (missing) {
    return (
      <div className="space-y-6 py-10 text-center">
        <p className="text-[16px] font-medium text-black">Order not found</p>
        <Link href="/app/orders" className={osUi.btnSecondary}>
          Back to orders
        </Link>
      </div>
    );
  }

  if (!order) {
    return (
      <p className="py-16 text-center text-[14px] text-black/40">Loading…</p>
    );
  }

  const nextStatus = NEXT[order.status];
  const flowIndex = FLOW.indexOf(
    order.status as (typeof FLOW)[number],
  );

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 pb-28">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => router.push("/app/orders")}
          className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center text-black/50 hover:text-black"
          aria-label="Back to orders"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={1.5} />
        </button>
        <div className="min-w-0 flex-1">
          <p className={osUi.pageEyebrow}>Order</p>
          <h1
            className="mt-1 text-[24px] font-medium tracking-tight text-black sm:text-[28px]"
            style={{ fontFamily: "var(--font-display), sans-serif" }}
          >
            {order.orderNumber}
          </h1>
          <p className="mt-1 text-[13px] text-black/40">
            {new Date(order.createdAt).toLocaleString("en-KE")}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {/* Status timeline */}
      {order.status !== "cancelled" ? (
        <div className="flex gap-1">
          {FLOW.map((step, i) => (
            <div key={step} className="min-w-0 flex-1">
              <div
                className={cn(
                  "h-1 w-full",
                  flowIndex >= i ? "bg-black" : "bg-black/10",
                )}
              />
              <p
                className={cn(
                  "mt-2 truncate text-[10px] uppercase tracking-[0.1em]",
                  flowIndex >= i ? "text-black/60" : "text-black/25",
                )}
              >
                {step}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <section className="space-y-1 text-[14px]">
        <p className={osUi.sectionLabel}>Customer</p>
        <p className="text-[16px] font-medium text-black">{order.customerName}</p>
        <p className="text-black/45">{order.customerEmail}</p>
        <p className="text-black/45">{order.customerPhone}</p>
        <p className="pt-2 text-black">
          Collect · <span className="font-medium">{order.collectHub}</span>
        </p>
      </section>

      <section>
        <p className={cn("mb-3", osUi.sectionLabel)}>Items</p>
        <ul className="divide-y divide-black/10 border-y border-black/10">
          {order.items.map((it, i) => (
            <li key={i} className="flex justify-between gap-3 py-3.5 text-[14px]">
              <span className="text-black">
                {it.quantity}× {it.name}
              </span>
              <span className="shrink-0 tabular-nums text-black/45">
                {formatKesMajor(it.unitPrice * it.quantity)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between text-[15px] font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatKesMajor(order.total)}</span>
        </div>
      </section>

      {order.notes ? (
        <p className="border border-black/10 bg-white px-4 py-3 text-[13px] text-black/70">
          {order.notes}
        </p>
      ) : null}

      <Show when="signed-out">
        <AuthModalTrigger
          redirect={`/app/orders/${encodeURIComponent(order.id)}`}
          className={cn(osUi.btnSecondary, "w-full")}
        >
          Sign in to update
        </AuthModalTrigger>
      </Show>

      <Show when="signed-in">
        <div className="space-y-6">
          {order.receiptPublicId ? (
            <Link
              href={`/r/${encodeURIComponent(order.receiptPublicId)}`}
              className={cn(osUi.btnGhost, "px-0")}
              target="_blank"
              rel="noreferrer"
            >
              Open receipt
            </Link>
          ) : null}

          <Link
            href={`/app/finance?refundOrder=${encodeURIComponent(order.id)}`}
            className={cn(osUi.btnGhost, "px-0")}
          >
            Refund help (platform finance)
          </Link>

          {order.status !== "cancelled" && order.status !== "collected" ? (
            <div className="space-y-3 border-t border-black/10 pt-6">
              <p className={osUi.sectionLabel}>Assign branch</p>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className={osUi.input}
              >
                <option value="">Select branch</option>
                {branches.map((b) => (
                  <option key={b.public_id} value={b.public_id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy || !branchId}
                onClick={() => void assignBranch()}
                className={cn(osUi.btnSecondary, "w-full")}
              >
                Save branch
              </button>
              {assignMsg ? (
                <p className="text-[12px] text-black/60">{assignMsg}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </Show>

      {/* Sticky actions */}
      <Show when="signed-in">
        {nextStatus ||
        (order.status !== "cancelled" && order.status !== "collected") ? (
          <div className="fixed inset-x-0 bottom-14 z-30 border-t border-black/10 bg-[var(--kc-canvas)] px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] lg:bottom-0">
            <div className="mx-auto flex max-w-2xl gap-2">
              {nextStatus ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void advance(nextStatus)}
                  className={cn(osUi.btnPrimary, "min-h-12 flex-1")}
                >
                  Mark {nextStatus}
                </button>
              ) : null}
              {order.status !== "cancelled" &&
              order.status !== "collected" ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void advance("cancelled")}
                  className={cn(osUi.btnSecondary, "min-h-12")}
                >
                  Reject
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Show>
    </div>
  );
}
