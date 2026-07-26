import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  DoorOpen,
  CalendarCheck,
  Users,
  Wallet,
  UserCog,
  UtensilsCrossed,
  Receipt,
  LifeBuoy,
  UserSquare2,
  Megaphone,
  BarChart3,
  Settings,
  Bell,
  Search,
  LogOut,
  ChevronDown,
  ClipboardList,
  Home,
  CreditCard,
  MessageSquare,
  UserCheck,
  FileText,
  Menu,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import type { Role } from "@/lib/demo-data";
import { NOTIFICATIONS } from "@/lib/demo-data";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }> };

const ADMIN_NAV: NavItem[] = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/properties", label: "Properties", icon: Building2 },
  { to: "/rooms", label: "Rooms & Beds", icon: DoorOpen },
  { to: "/bookings", label: "Bookings", icon: CalendarCheck },
  { to: "/tenants", label: "Tenants", icon: Users },
  { to: "/payments", label: "Rent & Payments", icon: Wallet },
  { to: "/staff", label: "Staff", icon: UserCog },
  { to: "/food", label: "Food & Menu", icon: UtensilsCrossed },
  { to: "/expenses", label: "Expenses", icon: Receipt },
  { to: "/complaints", label: "Complaints", icon: LifeBuoy },
  { to: "/visitors", label: "Visitors", icon: UserSquare2 },
  { to: "/notices", label: "Notices", icon: Megaphone },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

const STAFF_NAV: NavItem[] = [
  { to: "/dashboard", label: "Today", icon: LayoutDashboard },
  { to: "/tasks", label: "My Tasks", icon: ClipboardList },
  { to: "/complaints", label: "Complaints", icon: LifeBuoy },
  { to: "/visitors", label: "Visitors", icon: UserSquare2 },
  { to: "/bookings", label: "Check-ins", icon: CalendarCheck },
  { to: "/food", label: "Today's Menu", icon: UtensilsCrossed },
  { to: "/notices", label: "Notices", icon: Megaphone },
  { to: "/profile", label: "Profile", icon: UserCheck },
];

const TENANT_NAV: NavItem[] = [
  { to: "/dashboard", label: "My Home", icon: Home },
  { to: "/my-room", label: "My Room", icon: DoorOpen },
  { to: "/pay-rent", label: "Pay Rent", icon: CreditCard },
  { to: "/my-food", label: "Food Menu", icon: UtensilsCrossed },
  { to: "/my-complaints", label: "Complaints", icon: MessageSquare },
  { to: "/my-visitors", label: "Visitors", icon: UserSquare2 },
  { to: "/notices", label: "Notices", icon: Megaphone },
  { to: "/profile", label: "Profile & KYC", icon: FileText },
];

const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  admin: ADMIN_NAV,
  staff: STAFF_NAV,
  tenant: TENANT_NAV,
};

function BrandLogo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground font-bold">
        PG
      </div>
      <div className="flex flex-col leading-tight">
        <span className="font-semibold tracking-tight">PG One</span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Manage · Book · Live
        </span>
      </div>
    </Link>
  );
}

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-0.5 px-2">
      {items.map((item) => {
        const active = pathname === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function Sidebar({ role }: { role: Role }) {
  const items = NAV_BY_ROLE[role];
  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="h-16 flex items-center px-5 border-b border-sidebar-border">
        <BrandLogo />
      </div>
      <ScrollArea className="flex-1 py-3">
        <div className="mb-2 px-5 text-[11px] uppercase tracking-widest text-muted-foreground">
          {role === "admin" ? "Owner console" : role === "staff" ? "Staff panel" : "Resident"}
        </div>
        <NavList items={items} />
      </ScrollArea>
      <div className="p-3 border-t border-sidebar-border">
        <div className="rounded-lg bg-accent/60 p-3 text-xs text-accent-foreground">
          <div className="font-semibold mb-0.5">Demo mode</div>
          Data is seeded for preview. Switch roles from the top bar.
        </div>
      </div>
    </aside>
  );
}

function NotificationBell({ role }: { role: Role }) {
  const items = NOTIFICATIONS.filter((n) => n.role === role || n.role === "all");
  const unread = items.filter((n) => !n.read).length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute top-1.5 right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b p-3">
          <div className="font-semibold text-sm">Notifications</div>
          <Link to="/notifications" className="text-xs text-primary hover:underline">
            View all
          </Link>
        </div>
        <ScrollArea className="max-h-96">
          <div className="divide-y">
            {items.slice(0, 6).map((n) => (
              <div key={n.id} className="p-3 flex gap-3">
                <div
                  className={cn(
                    "mt-1 h-2 w-2 rounded-full shrink-0",
                    n.read ? "bg-muted" : "bg-primary",
                  )}
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{n.title}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">{n.time}</div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function RoleSwitcher() {
  const { user, setRole } = useAuth();
  if (!user) return null;
  const labels: Record<Role, string> = { admin: "Owner / Admin", staff: "Staff", tenant: "Tenant" };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 hidden md:inline-flex">
          <Badge variant="secondary" className="uppercase tracking-wide text-[10px]">
            Demo
          </Badge>
          <span className="text-xs">{labels[user.role]}</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Preview as</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(Object.keys(labels) as Role[]).map((r) => (
          <DropdownMenuItem key={r} onClick={() => setRole(r)}>
            {labels[r]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 px-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="hidden md:flex flex-col items-start leading-tight">
            <span className="text-sm font-medium">{user.name}</span>
            <span className="text-[10px] text-muted-foreground">{user.email}</span>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{user.name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>Profile</DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate({ to: "/notifications" })}>
          Notifications
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            logout();
            navigate({ to: "/auth" });
          }}
        >
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  if (!user) return null;
  const items = NAV_BY_ROLE[user.role];

  return (
    <div className="min-h-screen bg-background">
      <Sidebar role={user.role} />
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 h-16 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="h-full flex items-center gap-2 px-3 sm:px-5">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <div className="h-16 flex items-center px-5 border-b">
                  <BrandLogo />
                </div>
                <ScrollArea className="h-[calc(100vh-4rem)] py-3">
                  <NavList items={items} onNavigate={() => setMobileOpen(false)} />
                </ScrollArea>
              </SheetContent>
            </Sheet>

            <div className="hidden md:flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tenants, rooms, bookings…"
                  className="pl-9 h-9 bg-muted/40"
                />
              </div>
            </div>

            <div className="flex-1 md:hidden" />
            <div className="flex items-center gap-1.5">
              <RoleSwitcher />
              <NotificationBell role={user.role} />
              <UserMenu />
            </div>
          </div>
        </header>
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 mb-6 sm:flex sm:flex-wrap sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
