"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Show, SignInButton } from "@clerk/nextjs";
import { formatKesMajor } from "@/lib/money";
import { StatusBadge } from "@/components/os/StatusBadge";
import { osUi } from "@/components/os/os-ui";
import { cn } from "@/lib/utils";

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
  vendorId?: string;
  snapshot?: { storePublicId?: string; storeName?: string };
};

type Branch = {
  id: string;
  public_id: string;
  name: string;
};

type DriverOpt = {
  clerk_user_id: string;
  role: string;
  email?: string | null;
};

const TABS = [
  { id: "all", label: "All" },
  { id: "pending", label: "New" },
  { id: "confirmed", label: "Confirmed" },
  { id: "preparing", label: "Preparing" },
  { id: "ready", label: "Ready" },
  { id: "collected", label: "Collected" },
  { id: "returned", label: "Returned" },
] as const;

const NEXT: Record<string, string | null> = {
  pending: "confirmed",
  confirmed: "preparing",
  preparing: "ready",
  ready: "collected",
  collected: null,
  cancelled: null,
};

const DRIVER_ROLES = new Set([
  "vendor_driver",
  "independent_driver",
  "fleet_manager",
  "dispatch_manager",
]);

export function OrdersBoard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [driverClerkUserId, setDriverClerkUserId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [drivers, setDrivers] = useState<DriverOpt[]>([]);
  const [assignMsg, setAssignMsg] = useState<string | null>(null);
  const [canRefund, setCanRefund] = useState(false);

  async function load() {
    const res = await fetch("/api/os/orders");
    const json = await res.json();
    setOrders(json.data || []);
  }

  useEffect(() => {
    void load();
    void fetch("/api/os/me")
      .then((r) => r.json())
      .then(async (me) => {
        const vid = me?.data?.vendorIds?.[0] || "";
        const perms: string[] = me?.data?.permissions || [];
        setCanRefund(perms.includes("orders:refund"));
        if (!vid) return;
        const [bRes, sRes] = await Promise.all([
          fetch(`/api/os/branches?vendorId=${encodeURIComponent(vid)}`).then(
            (r) => r.json(),
          ),
          fetch(`/api/os/staff?vendorId=${encodeURIComponent(vid)}`).then((r) =>
            r.json(),
          ),
        ]);
        setBranches(bRes?.data || []);
        const staff = (sRes?.data || []) as Array<{
          clerk_user_id: string;
          role: string;
          email?: string | null;
          status?: string;
        }>;
        setDrivers(
          staff.filter(
            (s) =>
              DRIVER_ROLES.has(s.role) &&
              s.clerk_user_id &&
              !s.clerk_user_id.startsWith("email:"),
          ),
        );
      });
  }, []);

  const filtered = useMemo(() => {
    if (tab === "all") return orders;
    if (tab === "returned") {
      return orders.filter(
        (o) => o.status === "cancelled" || o.status === "returned",
      );
    }
    return orders.filter((o) => o.status === tab);
  }, [orders, tab]);

  const current = orders.find((o) => o.id === selected) || null;

  useEffect(() => {
    if (!current) return;
    setBranchId(current.snapshot?.storePublicId || "");
  }, [current?.id]);

  async function advance(id: string, status: string) {
    setBusy(true);
    setAssignMsg(null);
    try {
      const res = await fetch("/api/os/orders", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `os-order-${id}-${status}-${Date.now()}`,
        },
        body: JSON.stringify({ id, status }),
      });
      const json = await res.json();
      if (res.ok) await load();
      else alert(json?.error?.message || "Transition rejected");
    } finally {
      setBusy(false);
    }
  }

  async function assignBranch() {
    if (!current || !branchId) return;
    const branch = branches.find((b) => b.public_id === branchId);
    if (!branch) return;
    setBusy(true);
    setAssignMsg(null);
    try {
      const res = await fetch("/api/os/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: current.id,
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

  async function assignDriver() {
    if (!current || !driverClerkUserId.trim()) return;
    setBusy(true);
    setAssignMsg(null);
    try {
      const me = await fetch("/api/os/me").then((r) => r.json());
      const vendorId = current.vendorId || me?.data?.vendorIds?.[0] || "";
      if (!vendorId) {
        setAssignMsg("No vendor scope");
        return;
      }
      const createRes = await fetch("/api/os/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId,
          orderId: current.id,
          customerName: current.customerName,
          addressText: current.collectHub,
        }),
      });
      const created = await createRes.json();
      if (!createRes.ok) {
        setAssignMsg(created?.error?.message || "Create delivery failed");
        return;
      }
      const deliveryId = created?.data?.id;
      if (!deliveryId) {
        setAssignMsg("Delivery created without id");
        return;
      }
      const assignRes = await fetch("/api/os/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign",
          vendorId,
          id: deliveryId,
          driverClerkUserId: driverClerkUserId.trim(),
        }),
      });
      const assigned = await assignRes.json();
      if (!assignRes.ok) {
        setAssignMsg(assigned?.error?.message || "Assign failed");
        return;
      }
      setAssignMsg("Driver assigned");
      setDriverClerkUserId("");
    } finally {
      setBusy(false);
    }
  }

  function tabCount(id: (typeof TABS)[number]["id"]) {
    if (id === "all") return orders.length;
    if (id === "returned") {
      return orders.filter(
        (o) => o.status === "cancelled" || o.status === "returned",
      ).length;
    }
    return orders.filter((o) => o.status === id).length;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="overflow-hidden border-b border-black/10">
        <div className="flex flex-wrap gap-1 border-b border-black/10 pb-2.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "px-2.5 py-1.5 text-[12px] font-medium uppercase tracking-[0.1em] transition-colors",
                tab === t.id ? "text-black" : "text-black/40 hover:text-black",
              )}
            >
              {t.label}
              <span className="ml-1 text-black/30">{tabCount(t.id)}</span>
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead
              className={cn("border-b border-black/10 text-[12px]", osUi.muted)}
            >
              <tr>
                <th className="px-1 py-2.5 font-medium">Order</th>
                <th className="px-1 py-2.5 font-medium">Customer</th>
                <th className="px-1 py-2.5 font-medium">Collect</th>
                <th className="px-1 py-2.5 font-medium">Status</th>
                <th className="px-1 py-2.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06]">
              {filtered.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => setSelected(o.id)}
                  className={cn(
                    "cursor-pointer transition-colors",
                    selected === o.id
                      ? "bg-black/[0.03]"
                      : "hover:bg-black/[0.02]",
                  )}
                >
                  <td className="px-1 py-3">
                    <div className="font-medium text-black">
                      {o.orderNumber}
                    </div>
                    <div className={cn("text-[12px]", osUi.muted)}>
                      {new Date(o.createdAt).toLocaleString("en-KE")}
                    </div>
                  </td>
                  <td className="px-1 py-3">
                    <div className="font-medium text-black">
                      {o.customerName}
                    </div>
                    <div className={cn("text-[12px]", osUi.muted)}>
                      {o.customerEmail}
                    </div>
                  </td>
                  <td className={cn("px-1 py-3", osUi.muted)}>
                    {o.collectHub}
                  </td>
                  <td className="px-1 py-3">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="px-1 py-3 text-right font-medium tabular-nums text-black">
                    {formatKesMajor(o.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!filtered.length ? (
          <p className={cn("px-1 py-12 text-center text-[13px]", osUi.muted)}>
            No orders in this view
          </p>
        ) : null}
      </div>

      <aside className="h-fit border-b border-black/10 pb-4 lg:sticky lg:top-16 lg:border-b-0 lg:border-l lg:pl-4">
        {!current ? (
          <p className={cn("py-10 text-center text-[13px]", osUi.muted)}>
            Select an order
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-[15px] font-semibold text-black">
                  {current.orderNumber}
                </h3>
                <p className={cn("mt-0.5 text-[12px]", osUi.muted)}>
                  {new Date(current.createdAt).toLocaleString("en-KE")}
                </p>
              </div>
              <StatusBadge status={current.status} />
            </div>

            <div className="space-y-0.5 text-[13px]">
              <div className="font-medium text-black">
                {current.customerName}
              </div>
              <div className={osUi.muted}>{current.customerEmail}</div>
              <div className={osUi.muted}>{current.customerPhone}</div>
              <div className="pt-1 text-black">
                Collect ·{" "}
                <span className="font-medium">{current.collectHub}</span>
              </div>
            </div>

            <div className="border-t border-black/10 pt-3">
              <p className={cn("mb-2", osUi.sectionLabel)}>Items</p>
              <ul className="space-y-2 text-[13px]">
                {current.items.map((it, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="text-black">
                      {it.quantity}× {it.name}
                    </span>
                    <span className={cn("tabular-nums", osUi.muted)}>
                      {formatKesMajor(it.unitPrice * it.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex justify-between border-t border-black/10 pt-3 text-[13px] font-semibold">
                <span>Total</span>
                <span className="tabular-nums">
                  {formatKesMajor(current.total)}
                </span>
              </div>
            </div>

            {current.notes ? (
              <p className="bg-[#fff1e3] px-3 py-2 text-[12px] text-[#5e4200]">
                {current.notes}
              </p>
            ) : null}

            <Show when="signed-out">
              <SignInButton mode="redirect">
                <button
                  type="button"
                  className={cn(osUi.btnSecondary, "w-full")}
                >
                  Sign in to update
                </button>
              </SignInButton>
            </Show>
            <Show when="signed-in">
              <div className="flex flex-wrap gap-2">
                {NEXT[current.status] ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void advance(current.id, NEXT[current.status]!)
                    }
                    className={cn(osUi.btnPrimary, "flex-1")}
                  >
                    Mark {NEXT[current.status]}
                  </button>
                ) : null}
                {current.status !== "cancelled" &&
                current.status !== "collected" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void advance(current.id, "cancelled")}
                    className={osUi.btnSecondary}
                  >
                    Reject
                  </button>
                ) : null}
              </div>

              {canRefund ? (
                <Link
                  href={`/app/finance?refundOrder=${encodeURIComponent(current.id)}`}
                  className={cn(osUi.btnGhost, "w-full justify-start px-0")}
                >
                  Refund entry → Wallet
                </Link>
              ) : null}

              {current.status !== "cancelled" &&
              current.status !== "collected" ? (
                <>
                  <div className="space-y-2 border-t border-black/10 pt-3">
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
                  </div>

                  <div className="space-y-2 border-t border-black/10 pt-3">
                    <p className={osUi.sectionLabel}>Assign driver</p>
                    {drivers.length ? (
                      <select
                        value={driverClerkUserId}
                        onChange={(e) => setDriverClerkUserId(e.target.value)}
                        className={osUi.input}
                      >
                        <option value="">Select driver</option>
                        {drivers.map((d) => (
                          <option key={d.clerk_user_id} value={d.clerk_user_id}>
                            {d.email || d.clerk_user_id.slice(0, 16)} · {d.role}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={driverClerkUserId}
                        onChange={(e) => setDriverClerkUserId(e.target.value)}
                        placeholder="Driver Clerk user id"
                        className={osUi.input}
                      />
                    )}
                    <button
                      type="button"
                      disabled={busy || !driverClerkUserId.trim()}
                      onClick={() => void assignDriver()}
                      className={cn(osUi.btnSecondary, "w-full")}
                    >
                      Create + assign
                    </button>
                  </div>
                </>
              ) : null}

              {assignMsg ? (
                <p className="text-[12px] text-black/60">{assignMsg}</p>
              ) : null}
            </Show>
          </div>
        )}
      </aside>
    </div>
  );
}
