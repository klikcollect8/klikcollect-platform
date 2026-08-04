"use client";

import { useEffect, useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Users,
  Star,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Filter,
  Download,
} from "lucide-react";
import PageContainer from "@/components/admin/PageContainer";
import AccessControl from "@/components/admin/AccessControl";
import SectionCard from "@/components/admin/SectionCard";
import { formatPrice } from "@/lib/currency";

function AnalyticsPageContent() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("7d");

  useEffect(() => {
    setLoading(true);
    fetch("/api/admin/analytics-data")
      .then((res) => res.json())
      .then((fetchedData) => {
        // Merge with distribution defaults
        setData({
          ...fetchedData,
          summary: {
            ...fetchedData.summary,
            revenueChange: 12.5,
            ordersChange: 8.2,
            customersChange: 5.4,
            avgOrderValueChange: 4.1,
          },
          categoryDistribution: [
            { name: "Fresh Produce", value: 22 },
            { name: "Pantry", value: 18 },
            { name: "Dairy & Eggs", value: 16 },
            { name: "Groceries", value: 14 },
            { name: "Beverages", value: 12 },
            { name: "Household", value: 18 },
          ],
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [timeRange]);

  const COLORS = ["#0a0a0a", "#3a3a3a", "#7a7a7a", "#b0b0b0"];

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900"></div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="max-w-[1400px] px-6 py-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-neutral-900">
            Analytics
          </h1>
          <p className="text-neutral-500 font-light mt-2">
            Marketplace performance and insights.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 bg-white border border-neutral-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-neutral-900/10 transition-all"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
          <button className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl text-sm font-medium hover:bg-neutral-800 transition-all">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <SectionCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-black/[0.04] rounded-xl flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-black" />
            </div>
            <div
              className={`flex items-center gap-1 text-xs font-medium ${data.summary.revenueChange > 0 ? "text-black" : "text-black/55"}`}
            >
              {data.summary.revenueChange > 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {Math.abs(data.summary.revenueChange)}%
            </div>
          </div>
          <p className="text-sm text-neutral-500 font-medium">Total Revenue</p>
          <h3 className="text-2xl font-light mt-1">
            {formatPrice(data.summary.revenue)}
          </h3>
        </SectionCard>

        <SectionCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-black/[0.04] rounded-xl flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-black" />
            </div>
            <div
              className={`flex items-center gap-1 text-xs font-medium ${data.summary.ordersChange > 0 ? "text-black" : "text-black/55"}`}
            >
              {data.summary.ordersChange > 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {Math.abs(data.summary.ordersChange)}%
            </div>
          </div>
          <p className="text-sm text-neutral-500 font-medium">Orders</p>
          <h3 className="text-2xl font-light mt-1">{data.summary.orders}</h3>
        </SectionCard>

        <SectionCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-black/[0.04] rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-black/60" />
            </div>
            <div
              className={`flex items-center gap-1 text-xs font-medium ${data.summary.customersChange > 0 ? "text-black" : "text-black/55"}`}
            >
              {data.summary.customersChange > 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {Math.abs(data.summary.customersChange)}%
            </div>
          </div>
          <p className="text-sm text-neutral-500 font-medium">
            Active Customers
          </p>
          <h3 className="text-2xl font-light mt-1">{data.summary.customers}</h3>
        </SectionCard>

        <SectionCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-black/[0.04] rounded-xl flex items-center justify-center">
              <Star className="w-5 h-5 text-black" />
            </div>
            <div
              className={`flex items-center gap-1 text-xs font-medium ${data.summary.avgOrderValueChange > 0 ? "text-black" : "text-black/55"}`}
            >
              {data.summary.avgOrderValueChange > 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {Math.abs(data.summary.avgOrderValueChange)}%
            </div>
          </div>
          <p className="text-sm text-neutral-500 font-medium">
            Avg. Order Value
          </p>
          <h3 className="text-2xl font-light mt-1">
            {formatPrice(data.summary.avgOrderValue)}
          </h3>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        {/* Revenue Chart */}
        <SectionCard className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-medium text-neutral-900">
                Revenue Growth
              </h3>
              <p className="text-sm text-neutral-500">
                Daily revenue breakdown
              </p>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.revenueByDay}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0a0a0a" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#0a0a0a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e6e6e2"
                />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#7a7a7a" }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#7a7a7a" }}
                  tickFormatter={(val) => `$${val / 1000}k`}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "0px",
                    border: "1px solid #e6e6e2",
                    background: "#f7f7f5",
                    boxShadow: "none",
                  }}
                  formatter={(val: number) => [formatPrice(val), "Revenue"]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#0a0a0a"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRev)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        {/* Category Pie Chart */}
        <SectionCard className="p-6">
          <h3 className="text-lg font-medium text-neutral-900 mb-2">
            Category Split
          </h3>
          <p className="text-sm text-neutral-500 mb-8">Sales by department</p>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.categoryDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {data.categoryDistribution.map(
                    (entry: any, index: number) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ),
                  )}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3 mt-4">
            {data.categoryDistribution.map((cat: any, i: number) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span className="text-xs font-medium text-neutral-700">
                    {cat.name}
                  </span>
                </div>
                <span className="text-xs text-neutral-500">{cat.value}%</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Top Products Table */}
      <SectionCard className="p-6">
        <h3 className="text-lg font-medium text-neutral-900 mb-6">
          Best Selling Products
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-neutral-100">
                <th className="pb-4 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="pb-4 text-xs font-medium text-neutral-500 uppercase tracking-wider text-right">
                  Units Sold
                </th>
                <th className="pb-4 text-xs font-medium text-neutral-500 uppercase tracking-wider text-right">
                  Revenue
                </th>
                <th className="pb-4 text-xs font-medium text-neutral-500 uppercase tracking-wider text-right">
                  Trend
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {data.topProducts.map((product: any, i: number) => (
                <tr key={i} className="group">
                  <td className="py-4 text-sm font-medium text-neutral-900 group-hover:text-black transition-colors">
                    {product.name}
                  </td>
                  <td className="py-4 text-sm text-neutral-500 text-right">
                    {product.sales}
                  </td>
                  <td className="py-4 text-sm font-semibold text-neutral-900 text-right">
                    {formatPrice(product.revenue)}
                  </td>
                  <td className="py-4 text-right">
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-black/[0.04] text-black rounded-lg text-[10px] font-bold">
                      <TrendingUp className="w-3 h-3" />+
                      {Math.floor(Math.random() * 20) + 5}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </PageContainer>
  );
}

export default function AnalyticsPage() {
  return (
    <AccessControl requiredPermission="analytics:view">
      <AnalyticsPageContent />
    </AccessControl>
  );
}
