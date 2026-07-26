import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui-ext/stat";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { getOwnerReports } from "@/lib/api/functions/reports-fns";

export const Route = createFileRoute("/_app/reports")({ component: ReportsPage });

function formatCurrency(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

function ReportsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["reports", "mine"],
    queryFn: () => getOwnerReports(),
  });

  return (
    <>
      <PageHeader title="Reports" description="Operational and financial insights, computed from live data." />

      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <StatCard label="Total revenue collected" value={formatCurrency(data.totalRevenue)} tone="success" />
            <StatCard label="Current occupancy" value={`${data.avgOccupancyPct}%`} tone="info" />
            <StatCard label="Collection rate" value={`${data.collectionRate}%`} tone="success" />
            <StatCard label="Open complaints" value={data.openComplaints} tone="default" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <div className="font-semibold mb-1">Occupancy by property</div>
              <div className="text-xs text-muted-foreground mb-3">Beds occupied vs total, right now</div>
              {data.occupancyByProperty.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No properties yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data.occupancyByProperty}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar isAnimationActive={false} dataKey="total" name="Total beds" fill="#94a3b8" radius={[6, 6, 0, 0]} />
                    <Bar isAnimationActive={false} dataKey="occupied" name="Occupied" fill="#059669" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
            <Card className="p-5">
              <div className="font-semibold mb-1">Revenue vs expense</div>
              <div className="text-xs text-muted-foreground mb-3">By month, from actual payments &amp; expenses</div>
              {data.revenueTrend.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No paid rent or logged expenses yet.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={data.revenueTrend}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis fontSize={12} tickFormatter={(v) => `${(v as number) / 1000}k`} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, fontSize: 12 }}
                      formatter={(v) => formatCurrency(Number(v))}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line isAnimationActive={false} type="monotone" dataKey="revenue" stroke="#059669" strokeWidth={2} />
                    <Line isAnimationActive={false} type="monotone" dataKey="expense" stroke="#dc2626" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Card>
            <Card className="p-5 lg:col-span-2">
              <div className="font-semibold mb-1">Booking funnel</div>
              <div className="text-xs text-muted-foreground mb-3">All-time, by current status</div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.bookingFunnel}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="stage" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar isAnimationActive={false} dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
