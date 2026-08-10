"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Boxes,
  MessageCircleQuestion,
  Package,
  PackageCheck,
  ScanBarcode,
  ShoppingBag,
  Star,
  Users,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { osUi } from "@/components/os/os-ui";
import { OsStat } from "@/components/os/OsPanel";
import { cn } from "@/lib/utils";
import {
  resolveRoleChrome,
  softDashboardLinks,
  type RoleChromePlane,
} from "@/lib/workspace/role-chrome";

type Activity = {
  id: number;
  kind: string;
  title: string;
  body?: string | null;
  createdAt: string;
};

type Segment = { label: string; value: number; color: string };

type DashboardData = {
  storeName: string;
  today: {
    salesMinor: number;
    orders: number;
    profitMinor: number;
    completed: number;
  };
  wallet: {
    availableMinor: number;
    pendingMinor: number;
    heldMinor: number;
  };
  buckets: {
    waiting: number;
    packing: number;
    out: number;
    delivered: number;
    returned: number;
  };
  stock: { low: number; out: number; onHand: number; products: number };
  aovMinor: number;
  repeatRate: number;
  attention?: {
    unansweredQuestions: number;
    ordersWaiting: number;
    lowStock: number;
  };
  storeStatus?: {
    openNow: boolean;
    statusLabel: string;
    detailLabel: string;
    todayRange: string | null;
    clock: string;
    storeName: string;
  };
  activity: Activity[];
  charts?: {
    salesSeries: Array<{
      date: string;
      day: string;
      value: number;
      prev: number;
    }>;
    ordersSeries: Array<{ date: string; day: string; value: number }>;
    periodSalesMinor: number;
    salesDeltaPct: number;
    walletSegments: Segment[];
    orderSegments: Segment[];
  };
};

function kes(minor: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

function kesMajor(major: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(major);
}

function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat("en-KE", {
      hour: "numeric",
      hour12: false,
      timeZone: "Africa/Nairobi",
    }).format(new Date()),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const LINKS = [
  { href: "/app/orders", label: "View orders", icon: ShoppingBag },
  { href: "/app/inventory", label: "Update stock", icon: Boxes },
  { href: "/app/products", label: "Update prices", icon: Package },
  { href: "/app/orders/packing", label: "Packing", icon: PackageCheck },
  { href: "/app/pos", label: "POS", icon: ScanBarcode },
  { href: "/app/payments", label: "Request payout", icon: Wallet },
  { href: "/app/questions", label: "Questions", icon: MessageCircleQuestion },
  { href: "/app/reviews", label: "Reviews", icon: Star },
  { href: "/app/staff", label: "Manage staff", icon: Users },
];

const tooltipStyle = {
  border: "1px solid rgba(0,0,0,0.1)",
  background: "#f7f7f5",
  borderRadius: 0,
};

export function OsDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chartsReady, setChartsReady] = useState(false);
  const [chromePlane, setChromePlane] = useState<RoleChromePlane | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/os/me")
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        const role = body?.data?.role ? String(body.data.role) : null;
        const platformRole = body?.data?.platformRole
          ? String(body.data.platformRole)
          : null;
        const membershipRole = Array.isArray(body?.data?.memberships)
          ? body.data.memberships[0]?.role
            ? String(body.data.memberships[0].role)
            : null
          : null;
        const staffRole =
          membershipRole || (role === "platform_admin" ? null : role);
        const chrome = resolveRoleChrome({
          staffRole,
          platformRole: platformRole || (role === "platform_admin" ? role : null),
          hasVendor: true,
        });
        setChromePlane(chrome.plane);
      })
      .catch(() => {
        if (!cancelled) setChromePlane("vendor");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch("/api/os/dashboard")
        .then((r) => r.json())
        .then((body) => {
          if (cancelled) return;
          if (body?.data) {
            setData(body.data);
            setError(null);
          } else {
            setError(body?.error?.message || "Failed to load dashboard");
          }
        })
        .catch(() => {
          if (!cancelled) setError("Failed to load dashboard");
        });
    };
    load();
    const t = setInterval(load, 20_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => setChartsReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const softLinks = chromePlane ? softDashboardLinks(chromePlane) : null;
  const chrome = resolveRoleChrome({
    staffRole:
      chromePlane === "driver"
        ? "vendor_driver"
        : chromePlane === "store"
          ? "cashier"
          : null,
    hasVendor: true,
  });

  const charts = data?.charts;
  const salesSeries = charts?.salesSeries || [];
  const ordersSeries = charts?.ordersSeries || [];
  const orderSegments = charts?.orderSegments || [];
  const walletSegments = charts?.walletSegments || [];

  const peakOrders = useMemo(() => {
    if (!ordersSeries.length) return null;
    return ordersSeries.reduce((a, b) => (b.value > a.value ? b : a));
  }, [ordersSeries]);

  const orderSegTotal = orderSegments.reduce((s, c) => s + c.value, 0) || 1;
  const walletSegTotal = walletSegments.reduce((s, c) => s + c.value, 0) || 1;

  const todayLabel = new Intl.DateTimeFormat("en-KE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Africa/Nairobi",
  }).format(new Date());

  const delta = charts?.salesDeltaPct ?? 0;

  if (softLinks) {
    return (
      <div className="w-full space-y-10">
        <div
          className={cn(
            "px-5 py-6 text-white sm:px-7",
            chrome.accentBg,
          )}
        >
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">
            {chrome.label}
          </p>
          <h1
            className="mt-2 text-[clamp(1.6rem,4vw,2.2rem)] font-medium tracking-tight"
            style={{ fontFamily: "var(--font-display), sans-serif" }}
          >
            {data?.storeName
              ? `${greeting()}, ${data.storeName}`
              : greeting()}
          </h1>
          <p className="mt-2 text-[14px] text-white/70">
            {chromePlane === "driver"
              ? "Orders and packing handoff for pickup."
              : "Floor tools for packing and checkout."}
          </p>
        </div>
        {error ? <p className="text-[14px] text-[#8e1b0d]">{error}</p> : null}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {softLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex min-h-20 items-center justify-between border border-black/10 bg-white px-5 py-4 transition-colors hover:bg-black/[0.02]"
            >
              <span className="text-[16px] font-medium tracking-tight">
                {link.label}
              </span>
              <ArrowUpRight className="h-4 w-4 text-black/30" strokeWidth={1.5} />
            </Link>
          ))}
        </div>
        {data ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="border border-black/10 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.12em] text-black/35">
                Waiting
              </p>
              <p className="mt-1 text-[22px] font-medium tabular-nums">
                {data.buckets.waiting}
              </p>
            </div>
            <div className="border border-black/10 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.12em] text-black/35">
                Packing
              </p>
              <p className="mt-1 text-[22px] font-medium tabular-nums">
                {data.buckets.packing}
              </p>
            </div>
            <div className="border border-black/10 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.12em] text-black/35">
                Ready / out
              </p>
              <p className="mt-1 text-[22px] font-medium tabular-nums">
                {data.buckets.out}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="w-full space-y-12">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={osUi.pageEyebrow}>{todayLabel}</p>
          <h1
            className={cn("mt-2", osUi.pageTitle)}
            style={{ fontFamily: "var(--font-display), sans-serif" }}
          >
            {data?.storeName
              ? `${greeting()}, ${data.storeName}`
              : greeting()}
          </h1>
          <p className={cn("mt-2", osUi.pageDesc)}>
            How is business today?
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/pos" className={osUi.btnPrimary}>
            Open POS
          </Link>
          <Link href="/app/orders/packing" className={osUi.btnSecondary}>
            Packing
          </Link>
        </div>
      </div>

      {error ? <p className="text-[14px] text-[#8e1b0d]">{error}</p> : null}

      {data ? (
        <section className="rounded-[var(--kc-radius)] border border-black/10 bg-white px-5 py-5">
          <h2 className={cn("mb-4", osUi.sectionLabel)}>Needs attention</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <Link
              href="/app/orders"
              className="border border-black/[0.06] px-4 py-3 transition-colors hover:bg-black/[0.02]"
            >
              <p className="text-[11px] uppercase tracking-[0.12em] text-black/35">
                Orders waiting
              </p>
              <p className="mt-1 text-[22px] font-medium tabular-nums">
                {data.attention?.ordersWaiting ?? data.buckets.waiting}
              </p>
            </Link>
            <Link
              href="/app/questions"
              className="border border-black/[0.06] px-4 py-3 transition-colors hover:bg-black/[0.02]"
            >
              <p className="text-[11px] uppercase tracking-[0.12em] text-black/35">
                Unanswered questions
              </p>
              <p className="mt-1 text-[22px] font-medium tabular-nums">
                {data.attention?.unansweredQuestions ?? 0}
              </p>
            </Link>
            <Link
              href="/app/store#hours"
              className="border border-black/[0.06] px-4 py-3 transition-colors hover:bg-black/[0.02]"
            >
              <p className="text-[11px] uppercase tracking-[0.12em] text-black/35">
                Store status
              </p>
              <p className="mt-1 text-[18px] font-medium">
                {data.storeStatus?.openNow
                  ? "Open"
                  : data.storeStatus?.statusLabel || "Closed"}
              </p>
              <p className="mt-0.5 text-[11px] text-black/40">
                {data.storeStatus?.todayRange ||
                  data.storeStatus?.detailLabel ||
                  "Set hours"}
                {data.storeStatus?.clock
                  ? ` · ${data.storeStatus.clock}`
                  : ""}
              </p>
            </Link>
            <Link
              href="/app/inventory"
              className="border border-black/[0.06] px-4 py-3 transition-colors hover:bg-black/[0.02]"
            >
              <p className="text-[11px] uppercase tracking-[0.12em] text-black/35">
                Low / out of stock
              </p>
              <p className="mt-1 text-[22px] font-medium tabular-nums">
                {data.attention?.lowStock ?? data.stock.low + data.stock.out}
              </p>
            </Link>
            <Link
              href="/app/finance"
              className="border border-black/[0.06] px-4 py-3 transition-colors hover:bg-black/[0.02]"
            >
              <p className="text-[11px] uppercase tracking-[0.12em] text-black/35">
                Available balance
              </p>
              <p className="mt-1 text-[22px] font-medium tabular-nums">
                {kes(data.wallet.availableMinor)}
              </p>
            </Link>
            <Link
              href="/app/payments"
              className="border border-black/[0.06] px-4 py-3 transition-colors hover:bg-black/[0.02]"
            >
              <p className="text-[11px] uppercase tracking-[0.12em] text-black/35">
                Pending
              </p>
              <p className="mt-1 text-[22px] font-medium tabular-nums">
                {kes(data.wallet.pendingMinor)}
              </p>
            </Link>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/app/inventory" className={osUi.btnSecondary}>
              Update stock
            </Link>
            <Link href="/app/products" className={osUi.btnSecondary}>
              Update prices
            </Link>
            <Link href="/app/orders" className={osUi.btnSecondary}>
              View orders
            </Link>
            <Link href="/app/payments" className={osUi.btnPrimary}>
              Request payout
            </Link>
          </div>
        </section>
      ) : null}

      <section>
        <h2 className={cn("mb-5", osUi.sectionLabel)}>Today</h2>
        <div className="grid w-full gap-8 sm:grid-cols-2 xl:grid-cols-4">
          <OsStat
            label="Sales"
            value={data ? kes(data.today.salesMinor) : " - "}
            icon={Wallet}
            hint={
              data
                ? `${data.today.completed} completed · AOV ${kes(data.aovMinor)}`
                : " - "
            }
          />
          <OsStat
            label="Orders"
            value={data ? data.today.orders : " - "}
            icon={ShoppingBag}
            hint={
              data
                ? `${data.buckets.waiting} waiting · ${data.buckets.packing} packing`
                : " - "
            }
          />
          <OsStat
            label="Low / out of stock"
            value={
              data
                ? (data.attention?.lowStock ?? data.stock.low + data.stock.out)
                : " - "
            }
            icon={Boxes}
            hint={
              data
                ? `${data.stock.low} low · ${data.stock.out} out`
                : " - "
            }
            tone={
              data &&
              (data.attention?.lowStock ?? data.stock.low + data.stock.out) > 0
                ? "warn"
                : "default"
            }
          />
          <OsStat
            label="Available balance"
            value={data ? kes(data.wallet.availableMinor) : " - "}
            icon={Wallet}
            hint={
              data
                ? `Pending ${kes(data.wallet.pendingMinor)} · Held ${kes(data.wallet.heldMinor)}`
                : " - "
            }
          />
        </div>
      </section>

      {/* Sales area + orders bar - admin-style */}
      <div className="grid w-full gap-12 xl:grid-cols-12">
        <section className="min-w-0 xl:col-span-8">
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <h2 className={osUi.sectionLabel}>Sales · 14 days</h2>
              <p className="mt-2 text-[26px] font-medium tracking-tight text-black tabular-nums">
                {charts ? kes(charts.periodSalesMinor) : " - "}
              </p>
              <p className="mt-1 text-[13px] text-black/45">
                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}% vs prior 14 days
              </p>
            </div>
            <Link href="/app/finance" className={osUi.btnGhost}>
              Wallet
            </Link>
          </div>
          <div className="h-[220px] w-full min-w-0">
            {chartsReady && salesSeries.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <AreaChart data={salesSeries}>
                  <defs>
                    <linearGradient id="osSales" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="#0a0a0a"
                        stopOpacity={0.12}
                      />
                      <stop offset="100%" stopColor="#0a0a0a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(0,0,0,0.06)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(date) =>
                      salesSeries.find((d) => d.date === date)?.day || date
                    }
                    tick={{ fill: "rgba(0,0,0,0.35)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                    minTickGap={28}
                  />
                  <Tooltip
                    formatter={(v) => [kesMajor(Number(v ?? 0)), "Sales"]}
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload as
                        | { date?: string; day?: string }
                        | undefined;
                      return row?.date
                        ? `${row.day || ""} · ${row.date}`
                        : row?.day || "";
                    }}
                    contentStyle={tooltipStyle}
                  />
                  <Area
                    type="monotone"
                    dataKey="prev"
                    stroke="rgba(0,0,0,0.2)"
                    fill="transparent"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    name="Prior"
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#0a0a0a"
                    fill="url(#osSales)"
                    strokeWidth={2}
                    name="Sales"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-[13px] text-black/35">
                Loading chart…
              </div>
            )}
          </div>
        </section>

        <section className="min-w-0 xl:col-span-4">
          <h2 className={cn("mb-5", osUi.sectionLabel)}>Orders / day</h2>
          <div className="h-[220px] w-full min-w-0">
            {chartsReady && ordersSeries.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={ordersSeries}>
                  <XAxis
                    dataKey="date"
                    tickFormatter={(date) =>
                      ordersSeries.find((d) => d.date === date)?.day || date
                    }
                    tick={{ fill: "rgba(0,0,0,0.35)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                    minTickGap={18}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(0,0,0,0.03)" }}
                    contentStyle={tooltipStyle}
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload as
                        | { date?: string; day?: string }
                        | undefined;
                      return row?.date
                        ? `${row.day || ""} · ${row.date}`
                        : row?.day || "";
                    }}
                  />
                  <Bar dataKey="value" radius={0} isAnimationActive={false}>
                    {ordersSeries.map((entry) => (
                      <Cell
                        key={entry.date}
                        fill={
                          peakOrders && entry.date === peakOrders.date
                            ? "#0a0a0a"
                            : "rgba(0,0,0,0.12)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-[13px] text-black/35">
                Loading…
              </div>
            )}
          </div>
          {peakOrders ? (
            <p className="mt-2 text-[13px] text-black/40">
              Peak {peakOrders.day}: {peakOrders.value.toLocaleString("en-KE")}{" "}
              orders
            </p>
          ) : null}
        </section>
      </div>

      {/* Order buckets pie + wallet pie + segment bars */}
      <div className="grid w-full gap-12 xl:grid-cols-12">
        <section className="min-w-0 xl:col-span-4">
          <h2 className={cn("mb-5", osUi.sectionLabel)}>Order mix</h2>
          <div className="h-[200px] w-full min-w-0">
            {chartsReady && orderSegments.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    data={orderSegments}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={2}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {orderSegments.map((s) => (
                      <Cell key={s.label} fill={s.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-[13px] text-black/35">
                No open orders
              </div>
            )}
          </div>
          <div className="mt-2 space-y-2">
            {orderSegments.map((s) => (
              <div
                key={s.label}
                className="flex items-center justify-between text-[13px]"
              >
                <span className="flex items-center gap-2 text-black/55">
                  <span
                    className="inline-block h-2 w-2"
                    style={{ background: s.color }}
                  />
                  {s.label}
                </span>
                <span className="font-medium tabular-nums text-black">
                  {s.value} · {Math.round((s.value / orderSegTotal) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="min-w-0 xl:col-span-4">
          <h2 className={cn("mb-5", osUi.sectionLabel)}>Wallet split</h2>
          <div className="h-[200px] w-full min-w-0">
            {chartsReady && walletSegments.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    data={walletSegments}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={2}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {walletSegments.map((s) => (
                      <Cell key={s.label} fill={s.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => [kesMajor(Number(v ?? 0)), "KES"]}
                    contentStyle={tooltipStyle}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-[13px] text-black/35">
                No wallet balance yet
              </div>
            )}
          </div>
          <div className="mt-2 space-y-2">
            {(walletSegments.length
              ? walletSegments
              : [
                  { label: "Available", value: 0, color: "#0a0a0a" },
                  { label: "Pending", value: 0, color: "rgba(0,0,0,0.35)" },
                  { label: "Held", value: 0, color: "rgba(0,0,0,0.15)" },
                ]
            ).map((s) => (
              <div key={s.label}>
                <div className="mb-1.5 flex items-center justify-between text-[13px]">
                  <span className="text-black/55">{s.label}</span>
                  <span className="font-medium tabular-nums text-black">
                    {kesMajor(s.value)}
                  </span>
                </div>
                <div className="h-px w-full bg-black/10">
                  <div
                    className="h-px bg-black"
                    style={{
                      width: `${Math.max(
                        s.value > 0 ? 6 : 0,
                        (s.value / walletSegTotal) * 100,
                      )}%`,
                      opacity: s.label === "Available" ? 1 : 0.45,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="xl:col-span-4">
          <h2 className={cn("mb-5", osUi.sectionLabel)}>Stock pulse</h2>
          <div className="space-y-6">
            <OsStat
              label="On hand"
              value={data?.stock.onHand ?? " - "}
              icon={Boxes}
              hint={`${data?.stock.products ?? 0} listings`}
            />
            <OsStat
              label="Low stock"
              value={data?.stock.low ?? " - "}
              icon={Boxes}
              hint="≤ 5 units"
              tone={data && data.stock.low > 0 ? "warn" : "default"}
            />
            <OsStat
              label="Out of stock"
              value={data?.stock.out ?? " - "}
              icon={Boxes}
              hint="Needs restock"
              tone={data && data.stock.out > 0 ? "warn" : "default"}
            />
            <Link href="/app/inventory" className={cn(osUi.btnGhost, "!px-0")}>
              Open inventory
            </Link>
          </div>
        </section>
      </div>

      <section className="grid gap-12 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <h2 className={cn("mb-4", osUi.sectionLabel)}>Activity</h2>
          <div className="space-y-0 divide-y divide-black/8 border-t border-black/10">
            {(data?.activity || []).length === 0 ? (
              <p className="py-6 text-[14px] text-black/40">
                Live feed will show orders, payments, stock, and delivery
                updates.
              </p>
            ) : (
              (data?.activity || []).slice(0, 12).map((e) => (
                <div key={e.id} className="flex gap-4 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-black">
                      {e.title}
                    </p>
                    {e.body ? (
                      <p className="mt-0.5 text-[13px] text-black/45">
                        {e.body}
                      </p>
                    ) : null}
                  </div>
                  <p className="shrink-0 text-[11px] uppercase tracking-[0.12em] text-black/30">
                    {new Intl.DateTimeFormat("en-KE", {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Africa/Nairobi",
                    }).format(new Date(e.createdAt))}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <h2 className={cn("mb-4", osUi.sectionLabel)}>Jump to</h2>
          <div className="space-y-1">
            {LINKS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-center gap-3 py-2.5 text-[14px] text-black/55 transition-colors hover:text-black"
                >
                  <Icon className="h-4 w-4 text-black/30" strokeWidth={1.5} />
                  <span className="flex-1">{item.label}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
