import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusPill, statusTone } from "@/components/ui-ext/stat";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { getMyComplaints, createMyComplaint } from "@/lib/api/functions/tenant-fns";

export const Route = createFileRoute("/_app/my-complaints")({ component: MyComplaintsPage });

function MyComplaintsPage() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<"plumbing" | "electrical" | "wifi" | "cleaning" | "food" | "other">(
    "plumbing",
  );
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const { data: complaints, isLoading } = useQuery({
    queryKey: ["my-complaints"],
    queryFn: () => getMyComplaints(),
  });

  async function handleSubmit() {
    if (!title.trim()) {
      toast.error("Enter a short summary");
      return;
    }
    setSubmitting(true);
    try {
      await createMyComplaint({ data: { title, category, priority } });
      toast.success("Complaint submitted");
      setOpen(false);
      setTitle("");
      queryClient.invalidateQueries({ queryKey: ["my-complaints"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit complaint");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="My Complaints"
        description="Raise and track tickets."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-1" />
                Raise complaint
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New complaint</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="mb-1.5 block">Title</Label>
                  <Input placeholder="Short summary" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="mb-1.5 block">Category</Label>
                    <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="plumbing">Plumbing</SelectItem>
                        <SelectItem value="electrical">Electrical</SelectItem>
                        <SelectItem value="wifi">WiFi</SelectItem>
                        <SelectItem value="cleaning">Cleaning</SelectItem>
                        <SelectItem value="food">Food</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="mb-1.5 block">Priority</Label>
                    <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button className="w-full" disabled={submitting} onClick={handleSubmit}>
                  {submitting ? "Submitting…" : "Submit"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="grid gap-3">
        {isLoading ? (
          <Card className="p-8 text-center text-muted-foreground">Loading…</Card>
        ) : (complaints || []).length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">No complaints raised yet.</Card>
        ) : (
          (complaints || []).map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-medium">{c.title}</div>
                    <StatusPill tone={statusTone(c.priority)}>{c.priority}</StatusPill>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {c.id} · {c.category} · Raised {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—"}
                  </div>
                  {c.assignedTo && (
                    <div className="text-xs text-muted-foreground mt-0.5">Assigned to staff</div>
                  )}
                </div>
                <StatusPill tone={statusTone(c.status)}>{c.status}</StatusPill>
              </div>
            </Card>
          ))
        )}
      </div>
    </>
  );
}
