import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCheck } from "lucide-react";
import { useNotifications } from "@/hooks/use-notifications";

export const Route = createFileRoute("/_app/notifications")({ component: NotificationsPage });

function NotificationsPage() {
  const { items: mine, markAllRead, toggle, isLoading, error, refetch } = useNotifications();

  return (
    <>
      <PageHeader
        title="Notifications"
        description={`${mine.filter((n) => !n.read).length} unread`}
        actions={
          <Button variant="outline" size="sm" disabled={!mine.some((item) => !item.read)} onClick={markAllRead}>
            <CheckCheck className="h-4 w-4 mr-1" />
            Mark all read
          </Button>
        }
      />
      <Card className="divide-y">
        {isLoading && <p className="p-6 text-sm">Loading notices...</p>}
        {error && <div className="p-6"><p role="alert">Could not load notices.</p><Button variant="outline" onClick={() => refetch()}>Try again</Button></div>}
        {!isLoading && !error && mine.length === 0 && <p className="p-6 text-sm">No notifications yet.</p>}
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
