import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  listOwnerStaff,
  createStaff,
  updateStaffStatus,
  updateStaff,
  listStaffAttendance,
  recordStaffAttendance,
} from "@/lib/api/functions/staff-fns";
import { listOwnerProperties } from "@/lib/api/functions/properties-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/staff")({ component: StaffPage });

function formatCurrency(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

function StaffPage() {
  const [open, setOpen] = useState(false);
  const [attendanceMember, setAttendanceMember] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [editing, setEditing] = useState<Awaited<ReturnType<typeof listOwnerStaff>>[number] | null>(
    null,
  );
  const queryClient = useQueryClient();

  const { data: staffList, isLoading } = useQuery({
    queryKey: ["staff", "mine"],
    queryFn: () => listOwnerStaff(),
  });

  const { data: properties } = useQuery({
    queryKey: ["properties", "mine"],
    queryFn: () => listOwnerProperties(),
  });

  async function toggleStatus(id: string, current: string) {
    try {
      await updateStaffStatus({
        data: { id, status: current === "active" ? "on-leave" : "active" },
      });
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
                <TableHead>Attendance this month</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : !staffList || staffList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
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
                    <TableCell>
                      {s.attendance === null
                        ? "No records"
                        : `${s.attendance}% · ${s.attendanceDays} days recorded`}
                    </TableCell>
                    <TableCell>
                      <button onClick={() => toggleStatus(s.id, s.status)}>
                        <StatusPill tone={statusTone(s.status)}>{s.status}</StatusPill>
                      </button>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mr-2"
                        onClick={() => setAttendanceMember(s)}
                      >
                        Attendance
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditing(s)}>
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
      <Dialog
        open={!!attendanceMember}
        onOpenChange={(value) => {
          if (!value) setAttendanceMember(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attendance: {attendanceMember?.name}</DialogTitle>
          </DialogHeader>
          {attendanceMember && (
            <AttendanceForm key={attendanceMember.id} member={attendanceMember} />
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!editing}
        onOpenChange={(value) => {
          if (!value) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit staff member</DialogTitle>
          </DialogHeader>
          {editing && (
            <NewStaffForm
              key={editing.id}
              initial={editing}
              properties={properties || []}
              onCreated={() => {
                setEditing(null);
                queryClient.invalidateQueries({ queryKey: ["staff"] });
                queryClient.invalidateQueries({ queryKey: ["complaints"] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function AttendanceForm({ member }: { member: { id: string; name: string } }) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<"present" | "absent" | "on-leave">("present");
  const [saving, setSaving] = useState(false);
  const query = useQuery({
    queryKey: ["staff-attendance", member.id],
    queryFn: () => listStaffAttendance({ data: { staffId: member.id } }),
  });
  useEffect(() => {
    setStatus((query.data?.find((row) => row.date === date)?.status as typeof status) ?? "present");
  }, [query.data, date]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await recordStaffAttendance({ data: { staffId: member.id, date, status } });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["staff-attendance", member.id] }),
        queryClient.invalidateQueries({ queryKey: ["staff"] }),
      ]);
      toast.success("Attendance saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save attendance");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="space-y-3">
        <Label htmlFor="attendance-date">Date</Label>
        <Input
          id="attendance-date"
          type="date"
          required
          max={new Date().toISOString().slice(0, 10)}
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            const existing = query.data?.find((row) => row.date === e.target.value);
            setStatus((existing?.status as typeof status) ?? "present");
          }}
        />
        <Label>Status</Label>
        <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="present">Present</SelectItem>
            <SelectItem value="absent">Absent</SelectItem>
            <SelectItem value="on-leave">On leave</SelectItem>
          </SelectContent>
        </Select>
        <Button disabled={saving || query.isLoading || query.isError} type="submit">
          {saving ? "Saving…" : "Save attendance"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Saving an existing date updates its record. Attendance is the percentage of recorded days
          marked present, including leave days in the total.
        </p>
      </form>
      {query.isLoading ? (
        <p>Loading attendance…</p>
      ) : query.isError ? (
        <div role="alert">
          Could not load attendance. <Button onClick={() => query.refetch()}>Retry</Button>
        </div>
      ) : (
        <div className="max-h-48 overflow-y-auto space-y-2">
          {!query.data?.length && (
            <p className="text-sm text-muted-foreground">No attendance recorded yet.</p>
          )}
          {query.data?.map((row) => (
            <button
              key={row.date}
              className="block w-full text-left rounded border p-2 text-sm"
              onClick={() => {
                setDate(row.date);
                setStatus(row.status as typeof status);
              }}
            >
              {row.date} · {row.status}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NewStaffForm({
  properties,
  onCreated,
  initial,
}: {
  properties: { id: string; name: string }[];
  onCreated: () => void;
  initial?: Awaited<ReturnType<typeof listOwnerStaff>>[number];
}) {
  const [propertyId, setPropertyId] = useState(initial?.propertyId ?? properties[0]?.id ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [role, setRole] = useState<
    "manager" | "cook" | "housekeeping" | "security" | "maintenance"
  >(
    (initial?.role as "manager" | "cook" | "housekeeping" | "security" | "maintenance") ??
      "manager",
  );
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [shift, setShift] = useState<"morning" | "evening" | "night">(
    (initial?.shift as "morning" | "evening" | "night") ?? "morning",
  );
  const [salary, setSalary] = useState(initial ? String(initial.salary) : "");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const details = { name, role, phone, shift, salary: Number(salary || 0) };
      if (initial) await updateStaff({ data: { id: initial.id, ...details } });
      else await createStaff({ data: { propertyId, ...details } });
      toast.success(initial ? "Staff updated" : "Staff added");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add staff");
    } finally {
      setSubmitting(false);
    }
  }

  if (properties.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add a property first, then come back to add staff.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <Label className="mb-1.5 block">Property</Label>
        <Select value={propertyId} disabled={!!initial} onValueChange={setPropertyId}>
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
          <Input
            type="number"
            min={0}
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
            required
          />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Saving…" : initial ? "Save changes" : "Add staff"}
      </Button>
    </form>
  );
}
