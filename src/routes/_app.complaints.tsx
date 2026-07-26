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
import { StatusPill, statusTone } from "@/components/ui-ext/stat";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";
import { listOwnerComplaints, createComplaint, updateComplaint } from "@/lib/api/functions/complaints-fns";
import { listProperties } from "@/lib/api/functions/properties-fns";
import { listOwnerStaff } from "@/lib/api/functions/staff-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/complaints")({ component: ComplaintsPage });

function ComplaintsPage() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const groups = ["all", "open", "in-progress", "resolved", "closed"];

  const { data: complaints, isLoading } = useQuery({
    queryKey: ["complaints", "mine"],
    queryFn: () => listOwnerComplaints(),
  });

  const { data: properties } = useQuery({
    queryKey: ["properties", "mine"],
    queryFn: () => listProperties(),
  });

  const { data: staffList } = useQuery({
    queryKey: ["staff", "mine"],
    queryFn: () => listOwnerStaff(),
  });

  async function handleStatusChange(id: string, status: string) {
    try {
      await updateComplaint({ data: { id, status: status as any } });
      queryClient.invalidateQueries({ queryKey: ["complaints", "mine"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update ticket");
    }
  }

  async function handleAssign(id: string, assignedTo: string) {
    try {
      await updateComplaint({ data: { id, assignedTo } });
      queryClient.invalidateQueries({ queryKey: ["complaints", "mine"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not assign ticket");
    }
  }

  return (
    <>
      <PageHeader
        title="Complaints"
        description="Track tickets from raise to resolution."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button disabled={!properties || properties.length === 0}>
                <Plus className="h-4 w-4 mr-1" />
                New ticket
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Raise a ticket</DialogTitle>
              </DialogHeader>
              <NewComplaintForm
                properties={properties || []}
                onCreated={() => {
                  setOpen(false);
                  queryClient.invalidateQueries({ queryKey: ["complaints", "mine"] });
                }}
              />
            </DialogContent>
          </Dialog>
        }
      />
      <Tabs defaultValue="all">
        <TabsList>
          {groups.map((g) => (
            <TabsTrigger key={g} value={g} className="capitalize">
              {g}
            </TabsTrigger>
          ))}
        </TabsList>
        {groups.map((g) => (
          <TabsContent key={g} value={g} className="mt-4">
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Assigned</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          Loading…
                        </TableCell>
                      </TableRow>
                    ) : (
                      (complaints || [])
                        .filter((c) => g === "all" || c.status === g)
                        .map((c) => (
                          <TableRow key={c.id}>
                            <TableCell className="font-mono text-xs">{c.id}</TableCell>
                            <TableCell className="font-medium">{c.title}</TableCell>
                            <TableCell>{c.tenantName ?? "—"}</TableCell>
                            <TableCell>{c.roomNumber ?? "—"}</TableCell>
                            <TableCell className="capitalize">{c.category}</TableCell>
                            <TableCell>
                              <StatusPill tone={statusTone(c.priority)}>{c.priority}</StatusPill>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={c.assignedTo ?? "unassigned"}
                                onValueChange={(v) => handleAssign(c.id, v === "unassigned" ? "" : v)}
                              >
                                <SelectTrigger className="h-7 w-[130px] text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="unassigned">Unassigned</SelectItem>
                                  {(staffList || []).map((s) => (
                                    <SelectItem key={s.id} value={s.id}>
                                      {s.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select value={c.status} onValueChange={(v) => handleStatusChange(c.id, v)}>
                                <SelectTrigger className="h-7 w-[110px] text-xs p-0 border-0 bg-transparent">
                                  <StatusPill tone={statusTone(c.status)}>{c.status}</StatusPill>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="open">Open</SelectItem>
                                  <SelectItem value="in-progress">In progress</SelectItem>
                                  <SelectItem value="resolved">Resolved</SelectItem>
                                  <SelectItem value="closed">Closed</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}

function NewComplaintForm({
  properties,
  onCreated,
}: {
  properties: { id: string; name: string }[];
  onCreated: () => void;
}) {
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [category, setCategory] = useState<"plumbing" | "electrical" | "wifi" | "cleaning" | "food" | "other">(
    "other"
  );
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createComplaint({ data: { propertyId, title, roomNumber, category, priority } });
      toast.success("Ticket created");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create ticket");
    } finally {
      setSubmitting(false);
    }
  }

  if (properties.length === 0) {
    return <p className="text-sm text-muted-foreground">Add a property first, then come back to raise a ticket.</p>;
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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5 block">Room number</Label>
          <Input value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} />
        </div>
        <div>
          <Label className="mb-1.5 block">Category</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
            <SelectTrigger className="w-full">
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
      </div>
      <div>
        <Label className="mb-1.5 block">Priority</Label>
        <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
          <SelectTrigger className="w-full">
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
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Creating…" : "Create ticket"}
      </Button>
    </form>
  );
}
