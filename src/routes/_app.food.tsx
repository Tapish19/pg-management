import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { UtensilsCrossed, Check } from "lucide-react";
import { getFoodMenu, updateFoodMenuDay } from "@/lib/api/functions/food-fns";
import { listProperties } from "@/lib/api/functions/properties-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/food")({ component: FoodPage });

function FoodPage() {
  const { data: properties } = useQuery({
    queryKey: ["properties", "mine"],
    queryFn: () => listProperties(),
  });

  return (
    <>
      <PageHeader title="Food & Menu" description="Weekly meal plan per property." />
      {!properties ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : properties.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">Add a property first to set up its menu.</Card>
      ) : (
        <Tabs defaultValue={properties[0].id}>
          <TabsList className="flex-wrap h-auto">
            {properties.map((p) => (
              <TabsTrigger key={p.id} value={p.id}>
                {p.name}
              </TabsTrigger>
            ))}
          </TabsList>
          {properties.map((p) => (
            <TabsContent key={p.id} value={p.id} className="mt-4">
              <PropertyMenu propertyId={p.id} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </>
  );
}

function PropertyMenu({ propertyId }: { propertyId: string }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ breakfast: "", lunch: "", dinner: "" });
  const [saving, setSaving] = useState(false);

  const { data: menu, isLoading } = useQuery({
    queryKey: ["food-menu", propertyId],
    queryFn: () => getFoodMenu({ data: { propertyId } }),
  });

  function startEdit(row: { id: string; breakfast: string; lunch: string; dinner: string }) {
    setEditing(row.id);
    setDraft({ breakfast: row.breakfast, lunch: row.lunch, dinner: row.dinner });
  }

  async function saveEdit(id: string) {
    setSaving(true);
    try {
      await updateFoodMenuDay({ data: { id, ...draft } });
      queryClient.invalidateQueries({ queryKey: ["food-menu", propertyId] });
      setEditing(null);
      toast.success("Menu updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update menu");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading menu…</p>;

  return (
    <>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left">
              <tr>
                <th className="p-3">Day</th>
                <th className="p-3">Breakfast</th>
                <th className="p-3">Lunch</th>
                <th className="p-3">Dinner</th>
                {isAdmin && <th className="p-3"></th>}
              </tr>
            </thead>
            <tbody>
              {(menu || []).map((m, i: number) => (
                <tr key={m.id} className={i > 0 ? "border-t" : ""}>
                  <td className="p-3 font-medium align-top">{m.day}</td>
                  {editing === m.id ? (
                    <>
                      <td className="p-2">
                        <Input
                          value={draft.breakfast}
                          onChange={(e) => setDraft((d) => ({ ...d, breakfast: e.target.value }))}
                        />
                      </td>
                      <td className="p-2">
                        <Input value={draft.lunch} onChange={(e) => setDraft((d) => ({ ...d, lunch: e.target.value }))} />
                      </td>
                      <td className="p-2">
                        <Input
                          value={draft.dinner}
                          onChange={(e) => setDraft((d) => ({ ...d, dinner: e.target.value }))}
                        />
                      </td>
                      <td className="p-2">
                        <Button size="sm" disabled={saving} onClick={() => saveEdit(m.id)}>
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-3 text-muted-foreground">{m.breakfast || "—"}</td>
                      <td className="p-3 text-muted-foreground">{m.lunch || "—"}</td>
                      <td className="p-3 text-muted-foreground">{m.dinner || "—"}</td>
                      {isAdmin && (
                        <td className="p-3">
                          <Button size="sm" variant="ghost" onClick={() => startEdit(m)}>
                            Edit
                          </Button>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="mt-4 flex items-center gap-2">
        <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
        <Badge variant="outline">Veg + Non-veg options</Badge>
      </div>
    </>
  );
}
