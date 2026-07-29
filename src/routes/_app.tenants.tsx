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

type KycStatus = "verified" | "pending" | "missing";
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
import { Plus, Search } from "lucide-react";
import { listOwnerTenants, onboardTenant, updateTenantKyc } from "@/lib/api/functions/bookings-fns";
import { listProperties } from "@/lib/api/functions/properties-fns";
import { listOwnerRooms } from "@/lib/api/functions/rooms-fns";
import { listTenantRiskScores } from "@/lib/api/functions/risk-fns";
import { toast } from "sonner";

const RISK_BAND_TONE: Record<string, "success" | "warning" | "destructive"> = {
  low: "success",
  medium: "warning",
  high: "destructive",
};

export const Route = createFileRoute("/_app/tenants")({ component: TenantsPage });

function formatCurrency(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

function TenantsPage() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: tenantRows, isLoading } = useQuery({
    queryKey: ["tenants", "mine"],
    queryFn: () => listOwnerTenants(),
  });

  const { data: properties } = useQuery({
    queryKey: ["properties", "mine"],
    queryFn: () => listProperties(),
  });

  const { data: rooms } = useQuery({
    queryKey: ["rooms", "mine"],
    queryFn: () => listOwnerRooms(),
  });

  const { data: riskScores } = useQuery({
    queryKey: ["tenants", "risk-scores"],
    queryFn: () => listTenantRiskScores(),
  });

  const riskByTenantId = new Map((riskScores || []).map((r) => [r.tenantId, r]));

  const filtered = (tenantRows || []).filter((row) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return row.tenant?.name.toLowerCase().includes(q) || row.tenant?.email.toLowerCase().includes(q);
  });

  async function handleKyc(id: string, kycStatus: "verified" | "pending" | "missing") {
    try {
      await updateTenantKyc({ data: { id, kycStatus } });
      queryClient.invalidateQueries({ queryKey: ["tenants", "mine"] });
      toast.success("KYC updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update KYC");
    }
  }

  return (
    <>
      <PageHeader
        title="Tenants"
        description={tenantRows ? `${tenantRows.length} tenants` : ""}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-1" />
                Onboard tenant
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Onboard a tenant</DialogTitle>
              </DialogHeader>
              <OnboardTenantForm
                rooms={rooms || []}
                properties={properties || []}
                onCreated={() => {
                  setOpen(false);
                  queryClient.invalidateQueries({ queryKey: ["tenants", "mine"] });
                  queryClient.invalidateQueries({ queryKey: ["rooms", "mine"] });
                }}
              />
            </DialogContent>
          </Dialog>
        }
      />
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tenants…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Move-in</TableHead>
                <TableHead>Rent</TableHead>
                <TableHead>KYC</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Default Risk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No tenants yet. Onboard your first tenant to get started.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => {
                  const t = row.tenant!;
                  return (
                    <TableRow key={row.booking.id}>
                      <TableCell>
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback>
                              {t.name
                                .split(" ")
                                .map((p) => p[0])
                                .join("")
                                .slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="font-medium truncate">{t.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{t.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>Room {row.room?.roomNumber}</TableCell>
                      <TableCell>{row.booking.checkInDate}</TableCell>
                      <TableCell>{formatCurrency(row.booking.monthlyRent)}</TableCell>
                      <TableCell>
                        <Select value={t.kycStatus} onValueChange={(v) => handleKyc(t.id, v as KycStatus)}>
                          <SelectTrigger className="h-7 w-[110px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="verified">Verified</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="missing">Missing</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <StatusPill tone={statusTone(row.booking.status)}>{row.booking.status}</StatusPill>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const risk = riskByTenantId.get(t.id);
                          if (!risk) return <span className="text-xs text-muted-foreground">—</span>;
                          return (
                            <StatusPill tone={RISK_BAND_TONE[risk.riskBand]}>
                              {risk.riskBand} · {Math.round(risk.riskProbability * 100)}%
                            </StatusPill>
                          );
                        })()}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </>
  );
}

function OnboardTenantForm({
  rooms,
  onCreated,
}: {
  rooms: { id: string; roomNumber: string; propertyId: string; occupiedBeds: number; totalBeds: number }[];
  properties: { id: string; name: string }[];
  onCreated: () => void;
}) {
  const availableRooms = rooms.filter((r) => r.occupiedBeds < r.totalBeds);
  const [roomId, setRoomId] = useState(availableRooms[0]?.id ?? "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [moveIn, setMoveIn] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!roomId) {
      toast.error("No vacant rooms available");
      return;
    }
    setSubmitting(true);
    try {
      await onboardTenant({ data: { roomId, name, email, phone, moveIn, kycStatus: "pending" } });
      toast.success("Tenant onboarded");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not onboard tenant");
    } finally {
      setSubmitting(false);
    }
  }

  if (availableRooms.length === 0) {
    return <p className="text-sm text-muted-foreground">No vacant beds available. Add a room first.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <Label className="mb-1.5 block">Room</Label>
        <Select value={roomId} onValueChange={setRoomId}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableRooms.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                Room {r.roomNumber} ({r.totalBeds - r.occupiedBeds} vacant)
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
          <Label className="mb-1.5 block">Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <Label className="mb-1.5 block">Phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </div>
      </div>
      <div>
        <Label className="mb-1.5 block">Move-in date</Label>
        <Input type="date" value={moveIn} onChange={(e) => setMoveIn(e.target.value)} required />
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Onboarding…" : "Onboard tenant"}
      </Button>
    </form>
  );
}
