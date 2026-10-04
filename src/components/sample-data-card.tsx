import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { loadSampleData } from "@/lib/api/functions/sample-data-fns";
import { toast } from "sonner";

export function SampleDataCard() {
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();
  async function load() {
    setLoading(true);
    try {
      const result = await loadSampleData();
      await queryClient.invalidateQueries();
      toast.success(
        `Added ${result.properties} properties, ${result.rooms} rooms, ${result.tenants} residents and ${result.staff} staff.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load sample data");
    } finally {
      setLoading(false);
    }
  }
  return (
    <Card className="p-6 mb-6 space-y-3">
      <h2 className="font-semibold text-lg">Bring your dashboard to life</h2>
      <p className="text-sm text-muted-foreground">
        Explore three furnished PG properties with 18 rooms, 18 residents, 12 staff, weekly menus,
        visitor activity and six months of sample finances. Data is saved to your account and the
        properties appear in public listings, clearly marked as samples. Available for empty
        accounts only.
      </p>
      <Button disabled={loading} onClick={load}>
        {loading ? "Adding sample data…" : "Load sample data"}
      </Button>
    </Card>
  );
}
