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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus } from "lucide-react";
import { listOwnerStaff, createStaff, updateStaffStatus } from "@/lib/api/functions/staff-fns";
import { listProperties } from "@/lib/api/functions/properties-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/staff")({ component: StaffPage });

function formatCurrency(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

function StaffPage() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: staffList, isLoading } = useQuery({
    queryKey: ["staff", "mine"],
    queryFn: () => listOwnerStaff(),
  });

  const { data: properties } = useQuery({
    queryKey: ["properties", "mine"],
    queryFn: () => listProperties(),
  });

  async function toggleStatus(id: string, current: string) {
    try {
      await updateStaffStatus({ data: { id, status: current === "active" ? "on-leave" : "active" } });
      queryClient.invalidateQueries({ queryKey: ["staff", "mine"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update status");
    }
  }

  return (
    <>
      <PageHeader
        title="Staff"
        description={staffList ? `${staffList.length} people across your properties` : ""}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button disabled={!properties || properties.length === 0}>
                <Plus className="h-4 w-4 mr-1" />
                Add staff
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add staff member</DialogTitle>
              </DialogHeader>
              <NewStaffForm
                properties={properties || []}
                onCreated={() => {
                  setOpen(false);
                  queryClient.invalidateQueries({ queryKey: ["staff", "mine"] });
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
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead>Salary</TableHead>
                <TableHead>Attendance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : !staffList || staffList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No staff yet. Add your first team member.
                  </TableCell>
                </TableRow>
              ) : (
                staffList.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback>
                            {s.name
                              .split(" ")
                              .map((p) => p[0])
                              .join("")
                              .slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{s.name}</div>
                          <div className="text-xs text-muted-foreground">{s.phone}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{s.role}</TableCell>
                    <TableCell className="capitalize">{s.shift}</TableCell>
                    <TableCell>{formatCurrency(s.salary)}</TableCell>
                    <TableCell>{s.attendance}%</TableCell>
                    <TableCell>
                      <button onClick={() => toggleStatus(s.id, s.status)}>
                        <StatusPill tone={statusTone(s.status)}>{s.status}</StatusPill>
                      </button>
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

function NewStaffForm({
  properties,
  onCreated,
}: {
  properties: { id: string; name: string }[];
  onCreated: () => void;
}) {
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"manager" | "cook" | "housekeeping" | "security" | "maintenance">("manager");
  const [phone, setPhone] = useState("");
  const [shift, setShift] = useState<"morning" | "evening" | "night">("morning");
  const [salary, setSalary] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createStaff({ data: { propertyId, name, role, phone, shift, salary: Number(salary || 0) } });
      toast.success("Staff added");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add staff");
    } finally {
      setSubmitting(false);
    }
  }

  if (properties.length === 0) {
    return <p className="text-sm text-muted-foreground">Add a property first, then come back to add staff.</p>;
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
        <Label className="mb-1.5 block">Full name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5 block">Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="cook">Cook</SelectItem>
              <SelectItem value="housekeeping">Housekeeping</SelectItem>
              <SelectItem value="security">Security</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block">Shift</Label>
          <Select value={shift} onValueChange={(v) => setShift(v as typeof shift)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="morning">Morning</SelectItem>
              <SelectItem value="evening">Evening</SelectItem>
              <SelectItem value="night">Night</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5 block">Phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </div>
        <div>
          <Label className="mb-1.5 block">Salary (₹/mo)</Label>
          <Input type="number" min={0} value={salary} onChange={(e) => setSalary(e.target.value)} required />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Adding…" : "Add staff"}
      </Button>
    </form>
  );
}
