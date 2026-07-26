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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus } from "lucide-react";
import { listProperties } from "@/lib/api/functions/properties-fns";
import { listRooms, createRoom } from "@/lib/api/functions/rooms-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/rooms")({ component: RoomsPage });

function formatCurrency(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

function RoomsPage() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: properties, isLoading: propsLoading } = useQuery({
    queryKey: ["properties", "mine"],
    queryFn: () => listProperties(),
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
        <Tabs defaultValue={firstPropertyId}>
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
              <Badge variant={vacant > 0 ? "secondary" : "outline"}>{vacant > 0 ? "Available" : "Full"}</Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-1 capitalize">{r.sharingType}-sharing</div>
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
          </Card>
        );
      })}
    </div>
  );
}

function NewRoomForm({
  properties,
  onCreated,
}: {
  properties: { id: string; name: string }[];
  onCreated: (propertyId: string) => void;
}) {
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [roomNumber, setRoomNumber] = useState("");
  const [sharingType, setSharingType] = useState<"single" | "double" | "triple" | "dormitory">("double");
  const [totalBeds, setTotalBeds] = useState("2");
  const [rentPerBed, setRentPerBed] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createRoom({
        data: {
          propertyId,
          roomNumber,
          sharingType,
          totalBeds: Number(totalBeds),
          rentPerBed: Number(rentPerBed),
          depositAmount: Number(depositAmount || 0),
        },
      });
      toast.success("Room added");
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
          <Select value={sharingType} onValueChange={(v) => setSharingType(v as typeof sharingType)}>
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
          <Input type="number" min={1} value={totalBeds} onChange={(e) => setTotalBeds(e.target.value)} required />
        </div>
        <div>
          <Label className="mb-1.5 block">Rent/bed (₹)</Label>
          <Input type="number" min={0} value={rentPerBed} onChange={(e) => setRentPerBed(e.target.value)} required />
        </div>
        <div>
          <Label className="mb-1.5 block">Deposit (₹)</Label>
          <Input type="number" min={0} value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Adding…" : "Add room"}
      </Button>
    </form>
  );
}
