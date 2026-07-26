import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/app-shell";
import { COMPLAINTS } from "@/lib/demo-data";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusPill, statusTone } from "@/components/ui-ext/stat";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_app/tasks")({ component: TasksPage });

function TasksPage() {
  return (
    <>
      <PageHeader title="My Tasks" description="Tickets and duties assigned to you." />
      <div className="grid gap-3">
        {COMPLAINTS.map((c) => (
          <Card key={c.id} className="p-4 flex items-start gap-3">
            <Checkbox className="mt-1" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-medium">{c.title}</div>
                <StatusPill tone={statusTone(c.priority)}>{c.priority}</StatusPill>
                <StatusPill tone={statusTone(c.status)}>{c.status}</StatusPill>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {c.id} · Room {c.roomNumber} · Reported by {c.tenantName} · {c.createdAt}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline">
                Comment
              </Button>
              <Button size="sm">Update</Button>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
