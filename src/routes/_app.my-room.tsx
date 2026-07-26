import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/app-shell";
import { formatCurrency } from "@/lib/demo-data";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/ui-ext/stat";
import { BedDouble, Wifi, UtensilsCrossed, Snowflake, ShieldCheck, ArrowRight } from "lucide-react";
import { getMyBooking } from "@/lib/api/functions/tenant-fns";

export const Route = createFileRoute("/_app/my-room")({ component: MyRoomPage });

function parseList(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function MyRoomPage() {
  const { data, isLoading } = useQuery({ queryKey: ["my-booking"], queryFn: () => getMyBooking() });

  if (isLoading) {
    return (
      <>
        <PageHeader title="My Room" description="Loading your booking…" />
      </>
    );
  }

  if (!data || !data.booking || !data.room || !data.property) {
    return (
      <>
        <PageHeader title="My Room" description="No active booking found on your account." />
        <Card className="p-6 text-sm text-muted-foreground">
          Once your PG owner confirms your booking, your room details will show up here.
        </Card>
      </>
    );
  }

  const { booking, room, property } = data;
  const images = parseList(property.images);
  const amenities = parseList(room.amenities);

  return (
    <>
      <PageHeader title="My Room" description={`${property.name} · Room ${room.roomNumber}`} />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div>
          <Card className="overflow-hidden pt-0">
            <div className="aspect-[16/9] bg-muted">
              {images[0] ? (
                <img src={images[0]} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full grid place-items-center text-muted-foreground text-sm">
                  No photo yet
                </div>
              )}
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">Your room</div>
                  <div className="text-2xl font-bold">Room {room.roomNumber}</div>
                </div>
                <StatusPill tone={booking.status === "active" ? "success" : "warning"}>
                  {booking.status}
                </StatusPill>
              </div>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <MiniStat l="Sharing" v={`${room.sharingType}`} />
                <MiniStat l="Rent" v={formatCurrency(booking.monthlyRent)} />
                <MiniStat l="Deposit" v={formatCurrency(booking.depositAmount)} />
                <MiniStat l="Move-in" v={booking.checkInDate} />
              </div>
              {amenities.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {amenities.map((a) => (
                    <Badge key={a} variant="outline" className="gap-1 capitalize">
                      {a}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card className="p-5 mt-4">
            <div className="font-semibold mb-2">Property</div>
            <div className="text-sm text-muted-foreground">{property.address}</div>
            <div className="text-sm text-muted-foreground">
              {property.locality}, {property.city}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="font-semibold mb-3">Quick actions</div>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-between" asChild>
                <Link to="/pay-rent">
                  Pay rent <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-between" asChild>
                <Link to="/my-complaints">
                  Raise complaint <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-between" asChild>
                <Link to="/my-visitors">
                  Pre-approve visitor <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <BedDouble className="h-4 w-4" />
              <div className="font-semibold">Occupancy</div>
            </div>
            <div className="text-sm text-muted-foreground">
              {room.occupiedBeds} of {room.totalBeds} beds occupied in this room.
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function MiniStat({ l, v }: { l: string; v: string }) {
  return (
    <div className="rounded-md bg-muted/50 p-2">
      <div className="font-semibold">{v}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{l}</div>
    </div>
  );
}
