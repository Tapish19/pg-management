import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getPublicProperty } from "@/lib/api/functions/public-fns";
import { formatCurrency } from "@/lib/demo-data";
import { hasVacantBed } from "@/lib/room-availability";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, MapPin, Building2, Check } from "lucide-react";

export const Route = createFileRoute("/pg/$id")({
  loader: async ({ params }) => {
    const detail = await getPublicProperty({ data: { id: params.id } });
    if (!detail) throw notFound();
    return detail;
  },
  staleTime: 30_000,
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.property.name} — PG One` },
          {
            name: "description",
            content: `${loaderData.property.name} in ${loaderData.property.area}, ${loaderData.property.city}. ${loaderData.property.availableBeds} beds available.`,
          },
          ...(loaderData.property.image
            ? [{ property: "og:image", content: loaderData.property.image }]
            : []),
        ]
      : [{ title: "PG — PG One" }],
  }),
  component: PGDetail,
  pendingComponent: () => <p className="p-10 text-center">Loading property…</p>,
  errorComponent: ({ reset }) => (
    <div className="p-10 text-center" role="alert">
      Could not load this property. <Button onClick={reset}>Retry</Button>
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-10 text-center">
      <h1 className="text-lg font-semibold">PG not found</h1>
      <Button className="mt-4" variant="outline" asChild>
        <Link to="/browse">Back to browse</Link>
      </Button>
    </div>
  ),
});

function PGDetail() {
  const { property, menu, contactEmail, noticePeriodDays } = Route.useLoaderData();
  const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const sortedMenu = [...menu].sort((a, b) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day));
  const enquiry = `mailto:${contactEmail}?subject=${encodeURIComponent(`Room enquiry: ${property.name}`)}`;
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background/80 backdrop-blur z-30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/browse">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Browse
            </Link>
          </Button>
          <div className="flex-1" />
          <Button asChild>
            <a href={enquiry}>Contact owner</a>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
        <div className="aspect-[16/7] rounded-2xl overflow-hidden bg-muted">
          {property.image ? (
            <img src={property.image} alt={property.name} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full grid place-content-center text-muted-foreground">
              <Building2 className="h-14 w-14 mx-auto mb-3" />
              No photos added yet
            </div>
          )}
        </div>
        {property.images.length > 1 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            {property.images.slice(1).map((image, index) => (
              <img
                key={`${image}:${index}`}
                src={image}
                alt={`${property.name} photo ${index + 2}`}
                loading="lazy"
                className="aspect-video w-full rounded-lg object-cover"
              />
            ))}
          </div>
        )}
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div>
            <h1 className="text-3xl font-bold">{property.name}</h1>
            <p className="mt-2 text-sm text-muted-foreground flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {property.address} · {property.area}, {property.city}
            </p>
            <Badge variant="secondary" className="mt-3 capitalize">
              {property.gender}
            </Badge>
            {property.description && (
              <p className="mt-4 whitespace-pre-line text-sm">{property.description}</p>
            )}
            <Tabs defaultValue="rooms" className="mt-6">
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="rooms">Rooms</TabsTrigger>
                <TabsTrigger value="amenities">Amenities</TabsTrigger>
                <TabsTrigger value="menu">Food menu</TabsTrigger>
                <TabsTrigger value="rules">Rules</TabsTrigger>
                <TabsTrigger value="reviews">Reviews</TabsTrigger>
              </TabsList>
              <TabsContent value="rooms" className="mt-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {!property.rooms.length && (
                    <p className="text-sm text-muted-foreground">No rooms listed yet.</p>
                  )}
                  {property.rooms.map((room) => (
                    <Card key={room.id} className="p-4">
                      <div className="flex justify-between gap-2">
                        <h2 className="font-semibold">Room {room.roomNumber}</h2>
                        <Badge variant="outline">
                          {room.status === "maintenance"
                            ? "Maintenance"
                            : hasVacantBed(room)
                              ? "Available"
                              : "Full"}
                        </Badge>
                      </div>
                      <p className="text-sm mt-2 capitalize">{room.sharingType} sharing</p>
                      <p className="font-semibold mt-3">{formatCurrency(room.rentPerBed)}/month</p>
                      <p className="text-xs text-muted-foreground">
                        Deposit: {formatCurrency(room.depositAmount)}
                      </p>
                      <p className="text-sm mt-2">
                        {hasVacantBed(room) ? room.totalBeds - room.occupiedBeds : 0} beds available
                      </p>
                      {room.amenities.length > 0 && (
                        <p className="text-xs mt-2 text-muted-foreground">
                          {room.amenities.join(" · ")}
                        </p>
                      )}
                    </Card>
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="amenities" className="mt-4">
                <div className="grid grid-cols-2 gap-2">
                  {property.amenities.map((amenity, index) => (
                    <div
                      key={`${amenity}:${index}`}
                      className="rounded-lg border p-3 text-sm flex items-center gap-2"
                    >
                      <Check className="h-4 w-4 text-primary" />
                      {amenity}
                    </div>
                  ))}
                </div>
                {!property.amenities.length && (
                  <p className="text-sm text-muted-foreground">No property amenities listed yet.</p>
                )}
              </TabsContent>
              <TabsContent value="menu" className="mt-4">
                <Card className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        {["Day", "Breakfast", "Lunch", "Dinner"].map((label) => (
                          <th key={label} className="p-3 text-left">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedMenu.map((row) => (
                        <tr key={row.day} className="border-t">
                          <td className="p-3 font-medium">{row.day}</td>
                          <td className="p-3">{row.breakfast || "Not set"}</td>
                          <td className="p-3">{row.lunch || "Not set"}</td>
                          <td className="p-3">{row.dinner || "Not set"}</td>
                        </tr>
                      ))}
                      {!menu.length && (
                        <tr>
                          <td colSpan={4} className="p-6 text-muted-foreground">
                            The owner has not added a food menu yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </Card>
              </TabsContent>
              <TabsContent value="rules" className="mt-4">
                <Card className="p-5">
                  <p>Notice period: {noticePeriodDays} days.</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Contact the owner for house rules and booking terms.
                  </p>
                </Card>
              </TabsContent>
              <TabsContent value="reviews" className="mt-4">
                <p className="text-sm text-muted-foreground">
                  Resident reviews are not available yet.
                </p>
              </TabsContent>
            </Tabs>
          </div>
          <Card className="p-5 h-fit">
            <h2 className="font-semibold">Availability</h2>
            <p className="text-2xl font-bold mt-2">{property.availableBeds} beds free</p>
            <p className="text-sm mt-2">
              {property.rentFrom === null
                ? "Rent has not been listed yet."
                : `From ${formatCurrency(property.rentFrom)}/month`}
            </p>
            <p className="text-sm text-muted-foreground mt-3">
              Ask the owner about room availability and request a booking.
            </p>
            <Button asChild className="w-full mt-4">
              <a href={enquiry}>Enquire about a room</a>
            </Button>
          </Card>
        </div>
      </main>
    </div>
  );
}
