import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/app-shell";
import { NOTIFICATIONS } from "@/lib/demo-data";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { CheckCheck } from "lucide-react";
import { useState } from "react";
import { getMyNotices } from "@/lib/api/functions/tenant-fns";

export const Route = createFileRoute("/_app/notifications")({ component: NotificationsPage });

function NotificationsPage() {
  const { user } = useAuth();

  if (user?.role === "tenant") return <TenantNotifications />;

  // Owner / staff: general in-app notifications (not yet backed by a persisted table)
  const [items, setItems] = useState(NOTIFICATIONS);
  const mine = items.filter((n) => !user || n.role === user.role || n.role === "all");
  const markAllRead = () => setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  const toggle = (id: string) =>
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n)));

  return (
    <>
      <PageHeader
        title="Notifications"
        description={`${mine.filter((n) => !n.read).length} unread`}
        actions={
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck className="h-4 w-4 mr-1" />
            Mark all read
          </Button>
        }
      />
      <Card className="divide-y">
        {mine.map((n) => (
          <button
            key={n.id}
            onClick={() => toggle(n.id)}
            className={`w-full text-left p-4 flex gap-3 hover:bg-muted/40 transition ${!n.read ? "bg-accent/20" : ""}`}
          >
            <div
              className={`mt-1 h-2 w-2 rounded-full shrink-0 ${n.read ? "bg-muted" : "bg-primary"}`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-medium">{n.title}</div>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {n.category}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground mt-0.5">{n.body}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{n.time}</div>
            </div>
          </button>
        ))}
      </Card>
    </>
  );
}

function TenantNotifications() {
  const { data: notices, isLoading } = useQuery({
    queryKey: ["my-notices"],
    queryFn: () => getMyNotices(),
  });

  return (
    <>
      <PageHeader title="Notifications" description="Notices posted by your PG owner." />
      <Card className="divide-y">
        {isLoading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (notices || []).length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No notices yet.</div>
        ) : (
          (notices || []).map((n) => (
            <div key={n.id} className="p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-medium">{n.title}</div>
                <Badge variant="outline" className="text-[10px]">
                  {n.audience}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground mt-0.5">{n.body}</div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}
              </div>
            </div>
          ))
        )}
      </Card>
    </>
  );
}
