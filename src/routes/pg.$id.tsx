import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PROPERTIES, ROOMS, REVIEWS, FOOD_MENU, formatCurrency } from "@/lib/demo-data";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatusPill, statusTone } from "@/components/ui-ext/stat";
import {
  ArrowLeft,
  MapPin,
  Star,
  Check,
  Wifi,
  UtensilsCrossed,
  Snowflake,
  ShieldCheck,
} from "lucide-react";

export const Route = createFileRoute("/pg/$id")({
  loader: ({ params }) => {
    const p = PROPERTIES.find((x) => x.id === params.id);
    if (!p) throw notFound();
    return { property: p };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.property.name} — PG One` },
          {
            name: "description",
            content: `${loaderData.property.name} in ${loaderData.property.area}, ${loaderData.property.city}. From ${formatCurrency(loaderData.property.rentFrom)}/mo.`,
          },
          { property: "og:image", content: loaderData.property.image },
        ]
      : [{ title: "PG — PG One" }],
  }),
  component: PGDetail,
  notFoundComponent: () => (
    <div className="p-10 text-center">
      <div className="text-lg font-semibold">PG not found</div>
      <Button variant="outline" className="mt-4" asChild>
        <Link to="/browse">Back to browse</Link>
      </Button>
    </div>
  ),
});

function PGDetail() {
  const { property } = Route.useLoaderData();
  const rooms = ROOMS.filter((r) => r.propertyId === property.id);

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
            <Link to="/book/$id" params={{ id: property.id }}>
              Book a room
            </Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <div className="aspect-[16/10] rounded-2xl overflow-hidden bg-muted">
            <img src={property.image} alt={property.name} className="h-full w-full object-cover" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="aspect-square rounded-xl overflow-hidden bg-muted">
                <img
                  src={property.image}
                  alt=""
                  className="h-full w-full object-cover opacity-90"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{property.name}</h1>
                <div className="mt-1 text-sm text-muted-foreground inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {property.address}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-sm">
                  <Star className="h-4 w-4 fill-warning text-warning" />
                  {property.rating}
                </span>
                <span className="text-sm text-muted-foreground">({property.reviews} reviews)</span>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="secondary" className="capitalize">
                {property.gender}
              </Badge>
              {property.food && (
                <Badge variant="outline" className="gap-1">
                  <UtensilsCrossed className="h-3 w-3" />
                  Meals included
                </Badge>
              )}
              {property.ac && (
                <Badge variant="outline" className="gap-1">
                  <Snowflake className="h-3 w-3" />
                  AC rooms
                </Badge>
              )}
              <Badge variant="outline" className="gap-1">
                <ShieldCheck className="h-3 w-3" />
                Verified
              </Badge>
            </div>

            <Tabs defaultValue="rooms" className="mt-8">
              <TabsList>
                <TabsTrigger value="rooms">Rooms</TabsTrigger>
                <TabsTrigger value="amenities">Amenities</TabsTrigger>
                <TabsTrigger value="menu">Food menu</TabsTrigger>
                <TabsTrigger value="rules">Rules</TabsTrigger>
                <TabsTrigger value="reviews">Reviews</TabsTrigger>
              </TabsList>
              <TabsContent value="rooms" className="mt-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {rooms.map((r) => (
                    <Card key={r.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">Room {r.number}</div>
                        <StatusPill tone={statusTone(r.status)}>{r.status}</StatusPill>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Floor {r.floor} · {r.sharing}-sharing · {r.ac ? "AC" : "Non-AC"}
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <div>
                          <div className="text-lg font-bold">{formatCurrency(r.rent)}</div>
                          <div className="text-xs text-muted-foreground">
                            Deposit {formatCurrency(r.deposit)}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {r.bedsTotal - r.bedsOccupied} beds free
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="amenities" className="mt-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {property.amenities.map((a: string) => (
                    <div
                      key={a}
                      className="rounded-lg border p-3 text-sm inline-flex items-center gap-2"
                    >
                      <Check className="h-4 w-4 text-primary" />
                      {a}
                    </div>
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="menu" className="mt-4">
                <Card className="overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 text-left">
                      <tr>
                        <th className="p-3">Day</th>
                        <th className="p-3">Breakfast</th>
                        <th className="p-3">Lunch</th>
                        <th className="p-3">Dinner</th>
                      </tr>
                    </thead>
                    <tbody>
                      {FOOD_MENU.map((m) => (
                        <tr key={m.day} className="border-t">
                          <td className="p-3 font-medium">{m.day}</td>
                          <td className="p-3 text-muted-foreground">{m.breakfast}</td>
                          <td className="p-3 text-muted-foreground">{m.lunch}</td>
                          <td className="p-3 text-muted-foreground">{m.dinner}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </TabsContent>
              <TabsContent value="rules" className="mt-4">
                <ul className="space-y-2 text-sm">
                  {[
                    "Entry allowed till 11:00 PM",
                    "No smoking or alcohol on premises",
                    "Visitors allowed in common area only",
                    "Rent due on 5th of every month",
                    "30-day notice period before move-out",
                  ].map((r) => (
                    <li key={r} className="flex items-start gap-2">
                      <Check className="h-4 w-4 mt-0.5 text-primary" />
                      {r}
                    </li>
                  ))}
                </ul>
              </TabsContent>
              <TabsContent value="reviews" className="mt-4 space-y-3">
                {REVIEWS.map((r) => (
                  <Card key={r.name} className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{r.name}</div>
                      <div className="flex text-warning">
                        {Array.from({ length: r.rating }).map((_, i) => (
                          <Star key={i} className="h-3.5 w-3.5 fill-warning" />
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">"{r.text}"</p>
                  </Card>
                ))}
              </TabsContent>
            </Tabs>

            <Card className="mt-6 aspect-[16/6] bg-muted grid place-items-center text-muted-foreground text-sm">
              Map preview — {property.area}, {property.city}
            </Card>
          </div>

          <aside>
            <Card className="p-5 sticky top-20">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">
                Starting from
              </div>
              <div className="mt-1 text-3xl font-bold">
                {formatCurrency(property.rentFrom)}
                <span className="text-sm text-muted-foreground font-normal">/mo</span>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Deposit</span>
                  <span>1–2 months' rent</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Notice period</span>
                  <span>30 days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Available beds</span>
                  <span>{property.beds - property.occupied}</span>
                </div>
              </div>
              <Button className="w-full mt-5" asChild>
                <Link to="/book/$id" params={{ id: property.id }}>
                  Book a room
                </Link>
              </Button>
              <p className="text-[11px] text-muted-foreground mt-2 text-center">
                Free cancellation up to 24 hrs before move-in
              </p>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}
