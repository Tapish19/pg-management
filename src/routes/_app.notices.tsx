import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Megaphone, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { listOwnerNotices, createNotice } from "@/lib/api/functions/notices-fns";
import { listProperties } from "@/lib/api/functions/properties-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/notices")({ component: NoticesPage });

function NoticesPage() {
  const { user } = useAuth();
  const canPost = user?.role === "admin" || user?.role === "staff";
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: notices, isLoading } = useQuery({
    queryKey: ["notices", "mine"],
    queryFn: () => listOwnerNotices(),
  });

  const { data: properties } = useQuery({
    queryKey: ["properties", "mine"],
    queryFn: () => listProperties(),
  });

  return (
    <>
      <PageHeader
        title="Notices"
        description="Announcements to tenants and staff."
        actions={
          canPost ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button disabled={!properties || properties.length === 0}>
                  <Plus className="h-4 w-4 mr-1" />
                  Post notice
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Post a notice</DialogTitle>
                </DialogHeader>
                <NewNoticeForm
                  properties={properties || []}
                  postedBy={user?.name || "Admin"}
                  onCreated={() => {
                    setOpen(false);
                    queryClient.invalidateQueries({ queryKey: ["notices", "mine"] });
                  }}
                />
              </DialogContent>
            </Dialog>
          ) : undefined
        }
      />
      <div className="grid gap-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !notices || notices.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">No notices posted yet.</Card>
        ) : (
          notices.map((n) => (
            <Card key={n.id} className="p-5">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground shrink-0">
                  <Megaphone className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="font-semibold">{n.title}</div>
                    <div className="text-xs text-muted-foreground">{(n.createdAt || "").slice(0, 10)}</div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{n.body}</p>
                  <div className="text-xs text-muted-foreground mt-3">
                    To: {n.audience} · Posted by {n.postedBy}
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </>
  );
}

function NewNoticeForm({
  properties,
  postedBy,
  onCreated,
}: {
  properties: { id: string; name: string }[];
  postedBy: string;
  onCreated: () => void;
}) {
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("All tenants");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createNotice({ data: { propertyId, title, body, audience, postedBy } });
      toast.success("Notice posted");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not post notice");
    } finally {
      setSubmitting(false);
    }
  }

  if (properties.length === 0) {
    return <p className="text-sm text-muted-foreground">Add a property first, then come back to post notices.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <Label className="mb-1.5 block">Property</Label>
        <Select value={propertyId} onValueChange={setPropertyId}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {properties.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="mb-1.5 block">Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div>
        <Label className="mb-1.5 block">Body</Label>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} required />
      </div>
      <div>
        <Label className="mb-1.5 block">Audience</Label>
        <Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="All tenants" />
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Posting…" : "Post notice"}
      </Button>
    </form>
  );
}
