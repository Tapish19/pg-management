import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StatusPill } from "@/components/ui-ext/stat";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { getMyVisitors, createMyVisitor } from "@/lib/api/functions/tenant-fns";

export const Route = createFileRoute("/_app/my-visitors")({ component: MyVisitorsPage });

function MyVisitorsPage() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const { data: visitors, isLoading } = useQuery({
    queryKey: ["my-visitors"],
    queryFn: () => getMyVisitors(),
  });

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("Enter the visitor's name");
      return;
    }
    setSubmitting(true);
    try {
      await createMyVisitor({ data: { name, purpose: purpose || undefined } });
      toast.success("Visitor pre-approved");
      setOpen(false);
      setName("");
      setPurpose("");
      queryClient.invalidateQueries({ queryKey: ["my-visitors"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add visitor");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="My Visitors"
        description="Pre-approve guests to skip the queue."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-1" />
                Pre-approve
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Pre-approve visitor</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="mb-1.5 block">Visitor name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label className="mb-1.5 block">Purpose</Label>
                  <Input
                    placeholder="e.g. Family visit"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                  />
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
        ) : (visitors || []).length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">No visitors yet.</Card>
        ) : (
          (visitors || []).map((v) => (
            <Card key={v.id} className="p-4 flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="font-medium">{v.name}</div>
                <div className="text-xs text-muted-foreground">
                  {v.purpose || "—"} · {new Date(v.checkIn).toLocaleString()}
                </div>
              </div>
              <StatusPill tone={v.idVerified ? "success" : "warning"}>
                {v.idVerified ? "Verified" : "Unverified"}
              </StatusPill>
            </Card>
          ))
        )}
      </div>
    </>
  );
}
