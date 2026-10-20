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
import { StatusPill, statusTone } from "@/components/ui-ext/stat";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { getMyVisitors, createMyVisitor } from "@/lib/demo-api";
import { visitorVisitStatus } from "@/lib/visitor-approval";

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
    refetchInterval: 10_000,
  });

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("Enter the visitor's name");
      return;
    }
    setSubmitting(true);
    try {
      await createMyVisitor({ data: { name, purpose: purpose || undefined } });
      toast.success("Visitor request sent to your owner");
      setOpen(false);
      setName("");
      setPurpose("");
      queryClient.invalidateQueries({ queryKey: ["my-visitors"] });
      queryClient.invalidateQueries({ queryKey: ["visitors"] });
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
        description="Request approval for a guest. Your owner must approve before arrival; approval does not verify ID."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-1" />
                Request visitor
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request visitor approval</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="mb-1.5 block">Visitor name</Label>
                  <Input
                    id="visitor-request-name"
                    aria-label="Visitor name"
                    maxLength={120}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block">Purpose</Label>
                  <Input
                    placeholder="e.g. Family visit"
                    aria-label="Purpose"
                    maxLength={500}
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
                  {v.purpose || "—"}
                  {v.checkIn
                    ? ` · Arrived ${new Date(v.checkIn).toLocaleString()}`
                    : " · Not arrived"}
                </div>
              </div>
              <div className="space-y-1 text-right">
                <StatusPill tone={statusTone(v.approvalStatus)}>{visitorVisitStatus(v)}</StatusPill>
                <p className="text-xs text-muted-foreground">
                  ID {v.idVerified ? "verified" : "not verified"}
                </p>
              </div>
            </Card>
          ))
        )}
      </div>
    </>
  );
}
