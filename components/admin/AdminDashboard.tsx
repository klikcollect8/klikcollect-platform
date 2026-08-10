"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Flag,
  HeartPulse,
  ShoppingBag,
  SlidersHorizontal,
  Store,
  Ticket,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { adminUi } from "@/components/admin/admin-ui";
import StatCard from "@/components/admin/StatCard";
import { ControlPanel } from "@/components/os/ControlPanel";
import {
  DEFAULT_FEATURE_FLAGS,
  type FeatureFlags,
} from "@/lib/feature-flag-types";
import { cn } from "@/lib/utils";

export type AdminDashboardProps = {
  published: number;
  metrics: {
    vendorsPending: number;
    ordersOpen: number;
    ticketsOpen: number;
    lowStock: number;
    products: number;
    ordersTotal: number;
    openCorrections?: number;
    openContentReports?: number;
    heldPayouts?: number;
    gmvTodayMinor?: number;
  };
  profitKes: number;
  profitDelta: string;
  profitSeries: Array<{ day: string; value: number; prev: number }>;
  segments: Array<{ label: string; value: number; color: string }>;
  activity: Array<{ day: string; value: number }>;
  repeatRate: number;
  queues: Array<{
    title: string;
    value: number;
    hint: string;
    href: string;
  }>;
  initialFlags?: FeatureFlags;
  volumeLabel?: string;
};

export function AdminDashboard(props: AdminDashboardProps) {
  const [controlOpen, setControlOpen] = useState(false);
  const [flags, setFlags] = useState<FeatureFlags>(
    props.initialFlags || DEFAULT_FEATURE_FLAGS,
  );

  const peak = useMemo(() => {
    if (!props.activity.length) return null;
    return props.activity.reduce((a, b) => (b.value > a.value ? b : a));
  }, [props.activity]);

  const segmentTotal = props.segments.reduce((s, c) => s + c.value, 0) || 1;

  return (
    <div className="w-full space-y-12">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className={adminUi.pageEyebrow}>Platform</p>
          <h1
            className={cn("mt-2", adminUi.pageTitle)}
            style={{ fontFamily: "var(--font-display), sans-serif" }}
          >
            Overview
          </h1>
          <p className={cn("mt-2", adminUi.pageDesc)}>
            Marketplace ops · {props.published} published listings
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setControlOpen(true)}
            className={adminUi.btnGhost}
          >
            <SlidersHorizontal className="h-4 w-4" strokeWidth={1.5} />
            Control
          </button>
          <Link href="/admin/vendors" className={adminUi.btnPrimary}>
            Review vendors
          </Link>
        </div>
      </div>

      <section>
        <h2 className={cn("mb-5", adminUi.sectionLabel)}>Alerts</h2>
        <div className="grid w-full gap-8 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Pending vendors"
            value={props.metrics.vendorsPending}
            description="Awaiting curation"
            icon={Store}
            href="/admin/vendors"
          />
          <StatCard
            label="Open orders"
            value={props.metrics.ordersOpen}
            description={`of ${props.metrics.ordersTotal} total`}
            icon={ShoppingBag}
            href="/admin/orders"
          />
          <StatCard
            label="Content reports"
            value={props.metrics.openContentReports ?? 0}
            description="Moderation queue"
            icon={Flag}
            href="/admin/content-reports"
          />
          <StatCard
            label="Corrections / tickets"
            value={
              (props.metrics.openCorrections ?? 0) + props.metrics.ticketsOpen
            }
            description={`${props.metrics.ticketsOpen} support · ${props.metrics.openCorrections ?? 0} catalogue`}
            icon={Ticket}
            href="/admin/support"
          />
        </div>
      </section>

      <div className="grid w-full gap-12 xl:grid-cols-12">
        {flags.widget_profit ? (
          <section className="xl:col-span-8">
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <h2 className={adminUi.sectionLabel}>
                  {props.volumeLabel || "Marketplace GMV"}
                </h2>
                <p className="mt-2 text-[26px] font-medium tracking-tight text-black tabular-nums">
                  {props.profitKes >= 1000
                    ? `KES ${(props.profitKes / 1000).toFixed(1)}K`
                    : `KES ${props.profitKes.toLocaleString("en-KE")}`}
                </p>
                <p className="mt-1 text-[13px] text-black/45">
                  {props.profitDelta.startsWith("-") ? "" : props.profitDelta.includes("0%") ? "" : "▲ "}
                  {props.profitDelta}
                  {typeof props.metrics.gmvTodayMinor === "number"
                    ? ` · Today KES ${Math.round(props.metrics.gmvTodayMinor / 100).toLocaleString("en-KE")}`
                    : ""}
                </p>
              </div>
              <Link href="/admin/finance" className={adminUi.btnGhost}>
                Ledger
              </Link>
            </div>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={props.profitSeries}>
                  <defs>
                    <linearGradient
                      id="adminProfit"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
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
                    dataKey="day"
                    tick={{ fill: "rgba(0,0,0,0.35)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      border: "1px solid rgba(0,0,0,0.1)",
                      background: "#f7f7f5",
                      borderRadius: 0,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="prev"
                    stroke="rgba(0,0,0,0.2)"
                    fill="transparent"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#0a0a0a"
                    fill="url(#adminProfit)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
        ) : null}

        {flags.widget_activity ? (
          <section className="xl:col-span-4">
            <h2 className={cn("mb-5", adminUi.sectionLabel)}>
              Most day active
            </h2>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={props.activity}>
                  <XAxis
                    dataKey="day"
                    tick={{ fill: "rgba(0,0,0,0.35)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(0,0,0,0.03)" }}
                    contentStyle={{
                      border: "1px solid rgba(0,0,0,0.1)",
                      background: "#f7f7f5",
                      borderRadius: 0,
                    }}
                  />
                  <Bar dataKey="value" radius={0}>
                    {props.activity.map((entry) => (
                      <Cell
                        key={entry.day}
                        fill={
                          peak && entry.day === peak.day
                            ? "#0a0a0a"
                            : "rgba(0,0,0,0.12)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {peak ? (
              <p className="mt-2 text-[13px] text-black/40">
                Peak {peak.day}: {peak.value.toLocaleString("en-KE")}
              </p>
            ) : null}
          </section>
        ) : null}
      </div>

      <div className="grid w-full gap-12 xl:grid-cols-12">
        <section className="xl:col-span-5">
          <h2 className={cn("mb-5", adminUi.sectionLabel)}>Queues</h2>
          <div className="space-y-4">
            {props.queues.map((q) => (
              <Link
                key={q.href}
                href={q.href}
                className="flex items-baseline justify-between gap-4 border-b border-black/10 py-3 transition-opacity hover:opacity-70"
              >
                <div>
                  <p className="text-[15px] font-medium text-black">
                    {q.title}
                  </p>
                  <p className="mt-0.5 text-[13px] text-black/40">{q.hint}</p>
                </div>
                <span className="text-[22px] font-medium tabular-nums text-black">
                  {q.value}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="xl:col-span-3">
          <h2 className={cn("mb-5", adminUi.sectionLabel)}>Segments</h2>
          <div className="space-y-4">
            {props.segments.map((c) => (
              <div key={c.label}>
                <div className="mb-1.5 flex items-center justify-between text-[13px]">
                  <span className="text-black/55">{c.label}</span>
                  <span className="font-medium tabular-nums text-black">
                    {c.value.toLocaleString("en-KE")}
                  </span>
                </div>
                <div className="h-px w-full bg-black/10">
                  <div
                    className="h-px bg-black"
                    style={{
                      width: `${Math.max(6, (c.value / segmentTotal) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {flags.widget_repeat ? (
          <section className="xl:col-span-4">
            <h2 className={cn("mb-5", adminUi.sectionLabel)}>Ops health</h2>
            <p className="text-[40px] font-medium tracking-tight text-black tabular-nums">
              {props.repeatRate}%
            </p>
            <p className="mt-2 text-[13px] text-black/40">
              Clear-queue score · target 80%
            </p>
            <Link
              href="/admin/system"
              className={cn(adminUi.btnGhost, "mt-4 !px-0")}
            >
              System health
            </Link>
          </section>
        ) : null}
      </div>

      <section>
        <h2 className={cn("mb-5", adminUi.sectionLabel)}>Modules</h2>
        <div className="grid w-full grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          {[
            { href: "/admin/customers", label: "Customers", icon: Users },
            { href: "/admin/system", label: "Health", icon: HeartPulse },
            { href: "/admin/system/flags", label: "Flags", icon: Flag },
            { href: "/admin/system/logs", label: "Logs", icon: Activity },
          ].map((m) => {
            const Icon = m.icon;
            return (
              <Link
                key={m.href}
                href={m.href}
                className="flex items-center gap-2.5 py-1.5 text-[14px] text-black/50 transition-colors hover:text-black"
              >
                <Icon className="h-3.5 w-3.5 text-black/25" strokeWidth={1.5} />
                {m.label}
              </Link>
            );
          })}
        </div>
      </section>

      <ControlPanel
        open={controlOpen}
        onClose={() => setControlOpen(false)}
        onChanged={setFlags}
        variant="admin"
        title="Platform control"
        subtitle="Enable modules and dashboard widgets."
      />
    </div>
  );
}
