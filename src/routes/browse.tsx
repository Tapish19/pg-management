import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PROPERTIES, formatCurrency } from "@/lib/demo-data";
import { MapPin, Search, Star, Wifi, UtensilsCrossed, Snowflake, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/browse")({
  head: () => ({
    meta: [
      { title: "Browse PGs — PG One" },
      {
        name: "description",
        content: "Search and filter verified PGs by city, budget, sharing, food and amenities.",
      },
    ],
  }),
  component: Browse,
});

function Browse() {
  const [q, setQ] = useState("");
  const [gender, setGender] = useState<string>("any");
  const [food, setFood] = useState(false);
  const [ac, setAc] = useState(false);
  const [maxBudget, setMaxBudget] = useState<number[]>([15000]);

  const results = useMemo(
    () =>
      PROPERTIES.filter((p) => {
        if (q && !`${p.name} ${p.area} ${p.city}`.toLowerCase().includes(q.toLowerCase()))
          return false;
        if (gender !== "any" && p.gender !== gender) return false;
        if (food && !p.food) return false;
        if (ac && !p.ac) return false;
        if (p.rentFrom > maxBudget[0]) return false;
        return true;
      }),
    [q, gender, food, ac, maxBudget],
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
              PG
            </div>
            <span className="font-semibold hidden sm:inline">PG One</span>
          </Link>
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search area or PG name…"
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-5">
          <Card className="p-5">
            <div className="text-sm font-semibold mb-4">Filters</div>
            <div className="space-y-5">
              <div>
                <div className="text-xs text-muted-foreground mb-2">Gender</div>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="male">Male only</SelectItem>
                    <SelectItem value="female">Female only</SelectItem>
                    <SelectItem value="co-ed">Co-ed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-muted-foreground">Max budget</span>
                  <span className="font-medium">{formatCurrency(maxBudget[0])}</span>
                </div>
                <Slider
                  value={maxBudget}
                  onValueChange={setMaxBudget}
                  min={5000}
                  max={25000}
                  step={500}
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={food} onCheckedChange={(v) => setFood(!!v)} /> Food included
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={ac} onCheckedChange={(v) => setAc(!!v)} /> AC rooms
                </label>
              </div>
            </div>
          </Card>
        </aside>

        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-muted-foreground">{results.length} properties found</div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {results.map((p) => (
              <Link key={p.id} to="/pg/$id" params={{ id: p.id }}>
                <Card className="overflow-hidden pt-0 h-full transition hover:shadow-elegant">
                  <div className="aspect-video overflow-hidden bg-muted">
                    <img
                      src={p.image}
                      alt={p.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">{p.name}</h3>
                        <div className="text-xs text-muted-foreground mt-0.5 inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {p.area}, {p.city}
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs shrink-0">
                        <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                        {p.rating}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="capitalize">
                        {p.gender}
                      </Badge>
                      {p.food && (
                        <Badge variant="outline" className="gap-1">
                          <UtensilsCrossed className="h-3 w-3" />
                          Food
                        </Badge>
                      )}
                      {p.ac && (
                        <Badge variant="outline" className="gap-1">
                          <Snowflake className="h-3 w-3" />
                          AC
                        </Badge>
                      )}
                      <Badge variant="outline" className="gap-1">
                        <Wifi className="h-3 w-3" />
                        WiFi
                      </Badge>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <div className="text-sm">
                        From <span className="font-semibold">{formatCurrency(p.rentFrom)}</span>/mo
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {p.beds - p.occupied} beds free
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
          {results.length === 0 && (
            <Card className="p-10 text-center text-muted-foreground">
              No properties match those filters. Try widening your budget or clearing filters.
            </Card>
          )}
          <div className="mt-6">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back home
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
