import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/app-shell";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listOwnerComplaints, updateComplaint } from "@/lib/demo-api";
import { demoCall } from "@/lib/demo-store";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusPill, statusTone } from "@/components/ui-ext/stat";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_app/tasks")({ component: TasksPage });

function TasksPage() {
  const { user, isDemo } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const { data: complaints = [] } = useQuery({
    queryKey: ["complaints", "mine"],
    queryFn: () => listOwnerComplaints(),
    enabled: isDemo,
  });
  const tasks = complaints.filter((c) => c.assignedTo === user?.id);
  async function update(id: string, status: "resolved" | "in-progress") {
    try {
      await updateComplaint({ data: { id, status } });
      await queryClient.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update task");
    }
  }
  function addComment(id: string) {
    if (!comment.trim()) return;
    try {
      demoCall("addTaskComment", { id, comment: comment.trim() });
      setComment("");
      setEditing(null);
      toast.success("Comment saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save comment");
    }
  }
  return (
    <>
      <PageHeader title="My Tasks" description="Tickets and duties assigned to you." />
      <div className="grid gap-3">
        {!isDemo && <Card className="p-4">Staff tasks are available through demo login.</Card>}
        {tasks.map((c) => (
          <Card key={c.id} className="p-4 flex items-start gap-3">
            <Checkbox
              aria-label={`Complete ${c.title}`}
              className="mt-1"
              checked={["resolved", "closed"].includes(c.status)}
              onCheckedChange={(checked) => update(c.id, checked ? "resolved" : "in-progress")}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-medium">{c.title}</div>
                <StatusPill tone={statusTone(c.priority)}>{c.priority}</StatusPill>
                <StatusPill tone={statusTone(c.status)}>{c.status}</StatusPill>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {c.id} · Room {c.roomNumber} · Reported by {c.tenantName} · {c.createdAt}
              </div>
              {(demoCall("getTaskComments", { id: c.id }) as string[]).map((text, i) => (
                <p key={i} className="text-sm mt-2">
                  {text}
                </p>
              ))}
              {editing === c.id && (
                <div className="flex gap-2 mt-2">
                  <Input
                    aria-label="Task comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                  <Button size="sm" onClick={() => addComment(c.id)}>
                    Save comment
                  </Button>
                </div>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditing(editing === c.id ? null : c.id)}
              >
                Comment
              </Button>
              <Button
                size="sm"
                onClick={() => update(c.id, c.status === "open" ? "in-progress" : "resolved")}
              >
                {c.status === "open" ? "Start task" : "Resolve"}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
