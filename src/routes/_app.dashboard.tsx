import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/app-shell";
import { StatCard, StatusPill, statusTone } from "@/components/ui-ext/stat";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  BedDouble,
  Users,
  Wallet,
  AlertTriangle,
  UserCog,
  CalendarCheck,
  UtensilsCrossed,
  CreditCard,
  Home,
  Bell,
  ClipboardCheck,
  MessageSquare,
} from "lucide-react";
import {
  BOOKINGS,
  COMPLAINTS as DEMO_COMPLAINTS,
  EXPENSES,
  INVOICES,
  OCCUPANCY_TREND,
  REVENUE_TREND,
  BOOKING_FUNNEL,
  FOOD_PLAN_USAGE,
  PROPERTIES,
  STAFF,
  TENANTS,
  VISITORS,
  formatCurrency,
  FOOD_MENU,
  NOTIFICATIONS,
} from "@/lib/demo-data";
import { useQuery } from "@tanstack/react-query";
import { listProperties } from "@/lib/api/functions/properties-fns";
import { listOwnerTenants, listOwnerBookings } from "@/lib/api/functions/bookings-fns";
import { listOwnerStaff } from "@/lib/api/functions/staff-fns";
import { listOwnerComplaints } from "@/lib/api/functions/complaints-fns";
import { listOwnerVisitors } from "@/lib/api/functions/visitors-fns";
import { getFoodMenu } from "@/lib/api/functions/food-fns";
import { getMyBooking, getMyComplaints, getMyPayments, getMyNotices } from "@/lib/api/functions/tenant-fns";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/auth" />;
  if (user.role === "admin") return <AdminDashboard />;
  if (user.role === "staff") return <StaffDashboard />;
  return <TenantDashboard />;
}

// ---------- ADMIN ----------
function AdminDashboard() {
  const { data: properties } = useQuery({ queryKey: ["properties", "mine"], queryFn: () => listProperties() });
  const { data: tenantRows } = useQuery({ queryKey: ["tenants", "mine"], queryFn: () => listOwnerTenants() });
  const { data: bookings } = useQuery({ queryKey: ["bookings", "mine"], queryFn: () => listOwnerBookings() });
  const { data: staffList } = useQuery({ queryKey: ["staff", "mine"], queryFn: () => listOwnerStaff() });
  const { data: complaints } = useQuery({ queryKey: ["complaints", "mine"], queryFn: () => listOwnerComplaints() });

  const totalBeds = (properties || []).reduce((s, p) => s + (p.totalBeds ?? 0), 0);
  const occupied = (properties || []).reduce(
    (s, p) => s + ((p.totalBeds ?? 0) - (p.availableBeds ?? 0)),
    0,
  );
  const activeTenants = (tenantRows || []).filter((r) => r.booking.status === "active").length;
  const monthlyRevenue = (bookings || [])
    .filter((b) => b.status === "active" || b.status === "confirmed")
    .reduce((s, b) => s + b.monthlyRent, 0);
  const openComplaints = (complaints || []).filter(
    (c) => c.status !== "resolved" && c.status !== "closed",
  ).length;
  const pendingBookings = (bookings || []).filter((b) => b.status === "pending").length;

  return (
    <>
      <PageHeader
        title="Overview"
        description="Live snapshot across all your properties."
        actions={<Button size="sm" asChild><Link to="/properties">+ Add property</Link></Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Properties"
          value={properties?.length ?? 0}
          icon={Building2}
          tone="info"
        />
        <StatCard
          label="Beds"
          value={`${occupied} / ${totalBeds}`}
          hint={totalBeds ? `${Math.round((occupied / totalBeds) * 100)}% occupied` : "No rooms yet"}
          icon={BedDouble}
          tone="success"
        />
        <StatCard
          label="Active tenants"
          value={activeTenants}
          icon={Users}
          tone="default"
        />
        <StatCard
          label="Monthly rent value"
          value={formatCurrency(monthlyRevenue)}
          icon={Wallet}
          tone="success"
        />
        <StatCard
          label="Staff"
          value={staffList?.length ?? 0}
          hint={staffList ? `${staffList.filter((s) => s.status === "active").length} on duty` : undefined}
          icon={UserCog}
        />
        <StatCard
          label="Open complaints"
          value={openComplaints}
          icon={MessageSquare}
          tone="warning"
        />
        <StatCard
          label="Pending bookings"
          value={pendingBookings}
          hint="Awaiting approval"
          icon={CalendarCheck}
          tone="info"
        />
      </div>

      <div className="grid gap-4 mt-6 lg:grid-cols-2">
        <ChartCard title="Occupancy trend" subtitle="Beds occupied over last 6 months">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={OCCUPANCY_TREND}>
              <defs>
                <linearGradient id="occ" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#059669" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#059669" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Area
                type="monotone"
                dataKey="occupied"
                stroke="#059669"
                fill="url(#occ)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Revenue vs expense" subtitle="Monthly, INR">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={REVENUE_TREND}>
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
        </ChartCard>
        <ChartCard title="Booking funnel" subtitle="Last 30 days">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={BOOKING_FUNNEL}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="stage" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar isAnimationActive={false} dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Food plan usage" subtitle="Active subscriptions">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie isAnimationActive={false} data={FOOD_PLAN_USAGE} dataKey="count" nameKey="plan" outerRadius={90} label>
                {FOOD_PLAN_USAGE.map((_, i) => (
                  <Cell key={i} fill={["#059669","#2563eb","#d97706","#dc2626","#7c3aed"][i % 5]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-4 mt-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-semibold">Recent bookings</div>
              <div className="text-xs text-muted-foreground">Awaiting review or approved</div>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/bookings">View all</Link>
            </Button>
          </div>
          <div className="divide-y">
            {!bookings || bookings.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3">No bookings yet.</p>
            ) : (
              bookings.slice(0, 5).map((b) => (
                <div key={b.id} className="py-3 flex items-center gap-3 min-w-0">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-accent text-accent-foreground font-semibold shrink-0">
                    {(b.tenant?.name || "?")
                      .split(" ")
                      .map((p) => p[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{b.tenant?.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      Move-in {b.checkInDate} · {formatCurrency(b.monthlyRent)}
                    </div>
                  </div>
                  <StatusPill tone={statusTone(b.status)}>{b.status}</StatusPill>
                </div>
              ))
            )}
          </div>
        </Card>
        <Card className="p-5">
          <div className="font-semibold mb-4">Recent activity</div>
          <div className="space-y-3 text-sm">
            {NOTIFICATIONS.filter((n) => n.role === "admin" || n.role === "all")
              .slice(0, 6)
              .map((n) => (
                <div key={n.id} className="flex gap-2">
                  <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{n.title}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>
                  </div>
                </div>
              ))}
          </div>
        </Card>
      </div>
    </>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="mb-4">
        <div className="font-semibold">{title}</div>
        {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
      </div>
      {children}
    </Card>
  );
}

// ---------- STAFF ----------
function StaffDashboard() {
  const { user } = useAuth();
  const { data: complaints } = useQuery({ queryKey: ["complaints", "mine"], queryFn: () => listOwnerComplaints() });
  const { data: visitors } = useQuery({ queryKey: ["visitors", "mine"], queryFn: () => listOwnerVisitors() });
  const { data: properties } = useQuery({ queryKey: ["properties", "mine"], queryFn: () => listProperties() });
  const firstPropertyId = properties?.[0]?.id;
  const { data: menu } = useQuery({
    queryKey: ["food-menu", firstPropertyId],
    queryFn: () => getFoodMenu({ data: { propertyId: firstPropertyId! } }),
    enabled: !!firstPropertyId,
  });

  const tasks = (complaints || []).filter((c) => c.status !== "resolved" && c.status !== "closed");
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const todaysMenu = (menu || []).find((m) => m.day === today) as
    | { breakfast: string; lunch: string; dinner: string }
    | undefined;

  return (
    <>
      <PageHeader
        title="Today"
        description={`Good day, ${user?.name?.split(" ")[0] || "there"}. You have ${tasks.length} open tasks.`}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open tickets" value={tasks.length} icon={ClipboardCheck} tone="warning" />
        <StatCard label="Visitors logged" value={visitors?.length ?? 0} icon={Users} tone="info" />
        <StatCard
          label="Properties"
          value={properties?.length ?? 0}
          icon={CalendarCheck}
          tone="success"
        />
        <StatCard label="Menu today" value={today} icon={UtensilsCrossed} />
      </div>

      <div className="grid gap-4 mt-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">My tasks</div>
            <Button size="sm" variant="ghost" asChild>
              <Link to="/complaints">Open</Link>
            </Button>
          </div>
          <div className="divide-y">
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3">No open tickets. Nice work!</p>
            ) : (
              tasks.slice(0, 5).map((t) => (
                <div key={t.id} className="py-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{t.title}</div>
                    <div className="text-xs text-muted-foreground">
                      Room {t.roomNumber ?? "—"} · {t.category}
                    </div>
                  </div>
                  <StatusPill tone={statusTone(t.priority)}>{t.priority}</StatusPill>
                </div>
              ))
            )}
          </div>
        </Card>
        <Card className="p-5">
          <div className="font-semibold mb-3">Today's food plan</div>
          {todaysMenu ? (
            <div className="text-sm space-y-2">
              <div>
                <span className="text-muted-foreground">Breakfast:</span> {todaysMenu.breakfast || "Not set"}
              </div>
              <div>
                <span className="text-muted-foreground">Lunch:</span> {todaysMenu.lunch || "Not set"}
              </div>
              <div>
                <span className="text-muted-foreground">Dinner:</span> {todaysMenu.dinner || "Not set"}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No menu set for today yet.</p>
          )}
          <Button variant="ghost" size="sm" className="mt-4" asChild>
            <Link to="/food">Edit menu</Link>
          </Button>
        </Card>
      </div>
    </>
  );
}

// ---------- TENANT ----------
function TenantDashboard() {
  const { user } = useAuth();
  const { data: booking } = useQuery({ queryKey: ["my-booking"], queryFn: () => getMyBooking() });
  const { data: complaints } = useQuery({ queryKey: ["my-complaints"], queryFn: () => getMyComplaints() });
  const { data: myPayments } = useQuery({ queryKey: ["my-payments"], queryFn: () => getMyPayments() });
  const { data: notices } = useQuery({ queryKey: ["my-notices"], queryFn: () => getMyNotices() });

  const openComplaints = (complaints || []).filter((c) => c.status !== "resolved" && c.status !== "closed");
  const firstName = user?.name?.split(" ")[0] || "there";

  return (
    <>
      <PageHeader
        title={`Welcome home, ${firstName}`}
        description={
          booking?.property && booking?.room
            ? `${booking.property.name} · Room ${booking.room.roomNumber}`
            : "Your resident dashboard"
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2 bg-gradient-to-br from-primary/10 via-accent/40 to-card">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Monthly rent</div>
              <div className="mt-1 text-3xl font-bold">
                {formatCurrency(booking?.booking?.monthlyRent ?? 0)}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {booking?.booking ? `Booking status: ${booking.booking.status}` : "No active booking yet"}
              </div>
            </div>
            <div className="flex gap-2">
              <Button asChild>
                <Link to="/pay-rent">
                  <CreditCard className="h-4 w-4 mr-1" />
                  Pay now
                </Link>
              </Button>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Food menu</div>
          <div className="mt-1 text-lg font-semibold">This week</div>
          <div className="text-xs text-muted-foreground">Set by your PG's staff</div>
          <Button variant="outline" size="sm" className="mt-3" asChild>
            <Link to="/my-food">View menu</Link>
          </Button>
        </Card>
      </div>

      <div className="grid gap-4 mt-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Move-in" value={booking?.booking?.checkInDate ?? "—"} icon={Home} />
        <StatCard
          label="Deposit"
          value={formatCurrency(booking?.booking?.depositAmount ?? 0)}
          hint="Refundable"
          icon={Wallet}
          tone="info"
        />
        <StatCard
          label="Open complaints"
          value={openComplaints.length}
          icon={MessageSquare}
          tone="warning"
        />
        <StatCard label="Notices" value={notices?.length ?? 0} icon={Bell} tone="default" />
      </div>

      <div className="grid gap-4 mt-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">Payment history</div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/pay-rent">View all</Link>
            </Button>
          </div>
          <div className="divide-y">
            {(myPayments || []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-3">No payments yet.</p>
            ) : (
              (myPayments || []).slice(0, 4).map((p) => (
                <div key={p.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium capitalize">
                      {p.type} {p.month ? `· ${p.month}` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">{p.id}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{formatCurrency(p.amount)}</div>
                    <StatusPill tone={statusTone(p.status)}>{p.status}</StatusPill>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
        <Card className="p-5">
          <div className="font-semibold mb-3">Latest notices</div>
          <div className="space-y-3 text-sm">
            {(notices || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No notices yet.</p>
            ) : (
              (notices || []).slice(0, 3).map((n) => (
                <div key={n.id}>
                  <div className="font-medium">{n.title}</div>
                  <div className="text-xs text-muted-foreground">{n.body}</div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
