import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus } from "lucide-react";
import { listOwnerProperties } from "@/lib/api/functions/properties-fns";
import { listRooms, createRoom, updateRoom } from "@/lib/api/functions/rooms-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/rooms")({
  validateSearch: (search: Record<string, unknown>): { propertyId?: string } => ({
    propertyId: typeof search.propertyId === "string" ? search.propertyId : undefined,
  }),
  component: RoomsPage,
});

function formatCurrency(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

function RoomsPage() {
  const { propertyId } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: properties, isLoading: propsLoading } = useQuery({
    queryKey: ["properties", "mine"],
    queryFn: () => listOwnerProperties(),
  });

  const firstPropertyId = properties?.[0]?.id;

  return (
    <>
      <PageHeader
        title="Rooms & Beds"
        description={properties ? `${properties.length} properties` : ""}
        actions={
          properties && properties.length > 0 ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-1" />
                  New room
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add a room</DialogTitle>
                </DialogHeader>
                <NewRoomForm
                  properties={properties}
                  onCreated={(propertyId) => {
                    setOpen(false);
                    queryClient.invalidateQueries({ queryKey: ["rooms", propertyId] });
                    queryClient.invalidateQueries({ queryKey: ["properties"] });
                  }}
                />
              </DialogContent>
            </Dialog>
          ) : null
        }
      />

      {propsLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : !properties || properties.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          Add a property first, then come back to add rooms to it.
        </Card>
      ) : (
        <Tabs
          value={properties.some((p) => p.id === propertyId) ? propertyId : firstPropertyId}
          onValueChange={(selectedId) =>
            navigate({ search: { propertyId: selectedId }, replace: true })
          }
        >
          <TabsList className="flex-wrap h-auto">
            {properties.map((p) => (
              <TabsTrigger key={p.id} value={p.id}>
                {p.name}
              </TabsTrigger>
            ))}
          </TabsList>
          {properties.map((p) => (
            <TabsContent key={p.id} value={p.id} className="mt-4">
              <PropertyRooms propertyId={p.id} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </>
  );
}

function PropertyRooms({ propertyId }: { propertyId: string }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Awaited<ReturnType<typeof listRooms>>[number] | null>(
    null,
  );
  const { data: rooms, isLoading } = useQuery({
    queryKey: ["rooms", propertyId],
    queryFn: () => listRooms({ data: { propertyId } }),
  });

  if (isLoading) return <p className="text-muted-foreground text-sm">Loading rooms…</p>;
  if (!rooms || rooms.length === 0)
    return <p className="text-muted-foreground text-sm">No rooms yet for this property.</p>;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {rooms.map((r) => {
        const vacant = r.totalBeds - r.occupiedBeds;
        return (
          <Card key={r.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Room {r.roomNumber}</div>
              <Badge variant={vacant > 0 && r.status !== "maintenance" ? "secondary" : "outline"}>
                {r.status === "maintenance" ? "Maintenance" : vacant > 0 ? "Available" : "Full"}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-1 capitalize">
              {r.sharingType}-sharing
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-muted-foreground">Rent</div>
                <div className="font-semibold text-sm">{formatCurrency(r.rentPerBed)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Beds</div>
                <div className="font-semibold text-sm">
                  {r.occupiedBeds}/{r.totalBeds}
                </div>
              </div>
            </div>
            <Button className="mt-3" size="sm" variant="outline" onClick={() => setEditing(r)}>
              Edit room
            </Button>
          </Card>
        );
      })}
      <Dialog
        open={!!editing}
        onOpenChange={(value) => {
          if (!value) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit room</DialogTitle>
          </DialogHeader>
          {editing && (
            <NewRoomForm
              key={editing.id}
              initial={editing}
              properties={[{ id: propertyId, name: "Current property" }]}
              onCreated={() => {
                setEditing(null);
                for (const key of [
                  "rooms",
                  "properties",
                  "owner-rooms",
                  "owner-room-matches",
                  "bookings",
                  "tenants",
                  "my-booking",
                  "reports",
                ])
                  queryClient.invalidateQueries({ queryKey: [key] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NewRoomForm({
  properties,
  onCreated,
  initial,
}: {
  properties: { id: string; name: string }[];
  onCreated: (propertyId: string) => void;
  initial?: Awaited<ReturnType<typeof listRooms>>[number];
}) {
  const [propertyId, setPropertyId] = useState(initial?.propertyId ?? properties[0]?.id ?? "");
  const [roomNumber, setRoomNumber] = useState(initial?.roomNumber ?? "");
  const [sharingType, setSharingType] = useState<"single" | "double" | "triple" | "dormitory">(
    (initial?.sharingType as "single" | "double" | "triple" | "dormitory") ?? "double",
  );
  const [totalBeds, setTotalBeds] = useState(String(initial?.totalBeds ?? 2));
  const [rentPerBed, setRentPerBed] = useState(initial ? String(initial.rentPerBed) : "");
  const [depositAmount, setDepositAmount] = useState(initial ? String(initial.depositAmount) : "");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data = {
        propertyId,
        roomNumber,
        sharingType,
        totalBeds: Number(totalBeds),
        rentPerBed: Number(rentPerBed),
        depositAmount: Number(depositAmount || 0),
      };
      if (initial) await updateRoom({ data: { id: initial.id, ...data } });
      else await createRoom({ data });
      toast.success(initial ? "Room updated" : "Room added");
      onCreated(propertyId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add room");
    } finally {
      setSubmitting(false);
    }
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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5 block">Room number</Label>
          <Input value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} required />
        </div>
        <div>
          <Label className="mb-1.5 block">Sharing type</Label>
          <Select
            value={sharingType}
            onValueChange={(v) => setSharingType(v as typeof sharingType)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single">Single</SelectItem>
              <SelectItem value="double">Double</SelectItem>
              <SelectItem value="triple">Triple</SelectItem>
              <SelectItem value="dormitory">Dormitory</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="mb-1.5 block">Total beds</Label>
          <Input
            type="number"
            min={1}
            value={totalBeds}
            onChange={(e) => setTotalBeds(e.target.value)}
            required
          />
        </div>
        <div>
          <Label className="mb-1.5 block">Rent/bed (₹)</Label>
          <Input
            type="number"
            min={0}
            value={rentPerBed}
            onChange={(e) => setRentPerBed(e.target.value)}
            required
          />
        </div>
        <div>
          <Label className="mb-1.5 block">Deposit (₹)</Label>
          <Input
            type="number"
            min={0}
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
          />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Saving…" : initial ? "Save changes" : "Add room"}
      </Button>
      {initial && (
        <p className="text-sm text-muted-foreground">
          Rent and deposit changes apply to new bookings. Existing booking amounts stay as agreed.
        </p>
      )}
    </form>
  );
}
