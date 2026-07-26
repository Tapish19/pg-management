import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { MapPin, Building2, Plus, Search } from "lucide-react";
import { listProperties, createProperty } from "@/lib/api/functions/properties-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/properties")({ component: PropertiesPage });

function formatCurrency(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

function PropertiesPage() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: properties, isLoading } = useQuery({
    queryKey: ["properties", "mine"],
    queryFn: () => listProperties(),
  });

  const filtered = (properties ?? []).filter((p) =>
    `${p.name} ${p.city} ${p.locality}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <PageHeader
        title="Properties"
        description="All PGs in your organization."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-1" />
                New property
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add a PG property</DialogTitle>
              </DialogHeader>
              <NewPropertyForm
                onCreated={() => {
                  setOpen(false);
                  queryClient.invalidateQueries({ queryKey: ["properties"] });
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
            placeholder="Search properties…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          No properties yet. Click "New property" to add your first PG.
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Card key={p.id} className="overflow-hidden pt-0">
              <div className="aspect-[16/9] bg-muted overflow-hidden grid place-items-center">
                <Building2 className="h-10 w-10 text-muted-foreground/40" />
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {p.locality}, {p.city}
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <Stat n={p.roomCount} l="Rooms" />
                  <Stat n={p.totalBeds - p.availableBeds} l="Occupied" />
                  <Stat n={p.availableBeds} l="Vacant" />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="capitalize">
                    {p.genderType}
                  </Badge>
                  {p.minRent != null && <Badge variant="outline">From {formatCurrency(p.minRent)}</Badge>}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" asChild>
                    <Link to="/rooms">Rooms</Link>
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function Stat({ n, l }: { n: number; l: string }) {
  return (
    <div className="rounded-md bg-muted/50 p-2">
      <div className="font-semibold text-sm">{n}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{l}</div>
    </div>
  );
}

function NewPropertyForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [locality, setLocality] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [genderType, setGenderType] = useState<"male" | "female" | "co-ed">("male");
  const [amenities, setAmenities] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createProperty({
        data: {
          name,
          city,
          locality,
          address,
          description: description || undefined,
          genderType,
          amenities: amenities
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean),
        },
      });
      toast.success("Property created");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create property");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <Label className="mb-1.5 block">Property name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5 block">City</Label>
          <Input value={city} onChange={(e) => setCity(e.target.value)} required />
        </div>
        <div>
          <Label className="mb-1.5 block">Locality</Label>
          <Input value={locality} onChange={(e) => setLocality(e.target.value)} required />
        </div>
      </div>
      <div>
        <Label className="mb-1.5 block">Address</Label>
        <Input value={address} onChange={(e) => setAddress(e.target.value)} required />
      </div>
      <div>
        <Label className="mb-1.5 block">For</Label>
        <Select value={genderType} onValueChange={(v) => setGenderType(v as typeof genderType)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="male">Men</SelectItem>
            <SelectItem value="female">Women</SelectItem>
            <SelectItem value="co-ed">Co-ed</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="mb-1.5 block">Description</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      </div>
      <div>
        <Label className="mb-1.5 block">Amenities (comma separated)</Label>
        <Input value={amenities} onChange={(e) => setAmenities(e.target.value)} placeholder="WiFi, Food, AC" />
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Creating…" : "Create property"}
      </Button>
    </form>
  );
}
