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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusPill } from "@/components/ui-ext/stat";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";
import { listOwnerVisitors, createVisitor, checkOutVisitor } from "@/lib/api/functions/visitors-fns";
import { listProperties } from "@/lib/api/functions/properties-fns";
import { listOwnerTenants } from "@/lib/api/functions/bookings-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/visitors")({ component: VisitorsPage });

function VisitorsPage() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: visitors, isLoading } = useQuery({
    queryKey: ["visitors", "mine"],
    queryFn: () => listOwnerVisitors(),
  });

  const { data: properties } = useQuery({
    queryKey: ["properties", "mine"],
    queryFn: () => listProperties(),
  });

  const { data: tenantRows } = useQuery({
    queryKey: ["tenants", "mine"],
    queryFn: () => listOwnerTenants(),
  });

  async function handleCheckOut(id: string) {
    try {
      await checkOutVisitor({ data: { id, checkOut: new Date().toISOString().slice(0, 16).replace("T", " ") } });
      queryClient.invalidateQueries({ queryKey: ["visitors", "mine"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not check out visitor");
    }
  }

  return (
    <>
      <PageHeader
        title="Visitor Logbook"
        description="All check-ins across the property."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button disabled={!properties || properties.length === 0}>
                <Plus className="h-4 w-4 mr-1" />
                Log visitor
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Log a visitor</DialogTitle>
              </DialogHeader>
              <NewVisitorForm
                properties={properties || []}
                tenants={(tenantRows || []).map((r) => ({ id: r.tenant!.id, name: r.tenant!.name }))}
                onCreated={() => {
                  setOpen(false);
                  queryClient.invalidateQueries({ queryKey: ["visitors", "mine"] });
                }}
              />
            </DialogContent>
          </Dialog>
        }
      />
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Visitor</TableHead>
                <TableHead>Visiting</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Check-out</TableHead>
                <TableHead>ID verified</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : !visitors || visitors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No visitors logged yet.
                  </TableCell>
                </TableRow>
              ) : (
                visitors.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono text-xs">{v.id}</TableCell>
                    <TableCell className="font-medium">{v.name}</TableCell>
                    <TableCell>{v.tenantName ?? "—"}</TableCell>
                    <TableCell>{v.purpose}</TableCell>
                    <TableCell>{v.checkIn}</TableCell>
                    <TableCell>
                      {v.checkOut ? (
                        v.checkOut
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => handleCheckOut(v.id)}>
                          Check out
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusPill tone={v.idVerified ? "success" : "warning"}>
                        {v.idVerified ? "Verified" : "Unverified"}
                      </StatusPill>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </>
  );
}

function NewVisitorForm({
  properties,
  tenants,
  onCreated,
}: {
  properties: { id: string; name: string }[];
  tenants: { id: string; name: string }[];
  onCreated: () => void;
}) {
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [tenantId, setTenantId] = useState<string>(tenants[0]?.id ?? "none");
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [idVerified, setIdVerified] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createVisitor({
        data: {
          propertyId,
          tenantId: tenantId === "none" ? undefined : tenantId,
          name,
          purpose,
          checkIn: new Date().toISOString().slice(0, 16).replace("T", " "),
          idVerified,
        },
      });
      toast.success("Visitor logged");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not log visitor");
    } finally {
      setSubmitting(false);
    }
  }

  if (properties.length === 0) {
    return <p className="text-sm text-muted-foreground">Add a property first, then come back to log visitors.</p>;
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
        <Label className="mb-1.5 block">Visiting tenant</Label>
        <Select value={tenantId} onValueChange={setTenantId}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Not specific / delivery</SelectItem>
            {tenants.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="mb-1.5 block">Visitor name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <Label className="mb-1.5 block">Purpose</Label>
        <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Family visit, delivery…" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={idVerified} onChange={(e) => setIdVerified(e.target.checked)} />
        ID verified at gate
      </label>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Logging…" : "Log visitor"}
      </Button>
    </form>
  );
}
