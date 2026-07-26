import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { getMyFoodMenu } from "@/lib/api/functions/tenant-fns";

export const Route = createFileRoute("/_app/my-food")({ component: MyFoodPage });

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function MyFoodPage() {
  const { data: menu, isLoading } = useQuery({ queryKey: ["my-food-menu"], queryFn: () => getMyFoodMenu() });
  const sorted = [...(menu || [])].sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day));

  return (
    <>
      <PageHeader title="Food Menu" description="This week's menu at your property." />

      <Card className="p-5 mb-4 bg-gradient-to-br from-primary/10 via-accent/30 to-card">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-lg bg-primary text-primary-foreground">
            <UtensilsCrossed className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Weekly menu</div>
            <div className="text-lg font-semibold">Set by your PG's staff</div>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
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
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-muted-foreground">
                    Menu hasn't been set yet.
                  </td>
                </tr>
              ) : (
                sorted.map((m, i) => (
                  <tr key={m.id} className={i > 0 ? "border-t" : ""}>
                    <td className="p-3 font-medium">{m.day}</td>
                    <td className="p-3 text-muted-foreground">{m.breakfast || "—"}</td>
                    <td className="p-3 text-muted-foreground">{m.lunch || "—"}</td>
                    <td className="p-3 text-muted-foreground">{m.dinner || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5 mt-4">
        <div className="font-semibold mb-2">Meal feedback</div>
        <Textarea placeholder="Tell us how today's meal was…" />
        <Button className="mt-3" size="sm" onClick={() => toast.success("Feedback submitted")}>
          Submit
        </Button>
      </Card>
    </>
  );
}
