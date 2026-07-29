import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/app-shell";
import { formatCurrency } from "@/lib/demo-data";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusPill, statusTone } from "@/components/ui-ext/stat";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listOwnerBookings, updateBookingStatus } from "@/lib/api/functions/bookings-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/bookings")({ component: BookingsPage });

type BookingStatus = "pending" | "confirmed" | "active" | "checked_out" | "cancelled";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  active: "Active",
  checked_out: "Checked out",
  cancelled: "Cancelled",
};

function BookingsPage() {
  const queryClient = useQueryClient();
  const groups = ["all", "pending", "confirmed", "active", "checked_out", "cancelled"];

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["bookings", "mine"],
    queryFn: () => listOwnerBookings(),
  });

  async function handleStatusChange(id: string, status: string) {
    try {
      await updateBookingStatus({ data: { id, status: status as BookingStatus } });
      queryClient.invalidateQueries({ queryKey: ["bookings", "mine"] });
      queryClient.invalidateQueries({ queryKey: ["tenants", "mine"] });
      queryClient.invalidateQueries({ queryKey: ["rooms", "mine"] });
      toast.success("Booking updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update booking");
    }
  }

  return (
    <>
      <PageHeader title="Bookings" description="All booking requests across your properties." />
      <Tabs defaultValue="all">
        <TabsList>
          {groups.map((g) => (
            <TabsTrigger key={g} value={g} className="capitalize">
              {g === "all" ? "All" : STATUS_LABELS[g]}
            </TabsTrigger>
          ))}
        </TabsList>
        {groups.map((g) => (
          <TabsContent key={g} value={g} className="mt-4">
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Booking</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Property</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Move-in</TableHead>
                      <TableHead>Rent</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Loading…
                        </TableCell>
                      </TableRow>
                    ) : (bookings || []).filter((b) => g === "all" || b.status === g).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No bookings here yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (bookings || [])
                        .filter((b) => g === "all" || b.status === g)
                        .map((b) => (
                          <TableRow key={b.id}>
                            <TableCell className="font-mono text-xs">{b.id}</TableCell>
                            <TableCell className="font-medium">{b.tenant?.name ?? "—"}</TableCell>
                            <TableCell>{b.property?.name ?? "—"}</TableCell>
                            <TableCell>{b.room?.roomNumber ?? "—"}</TableCell>
                            <TableCell>{b.checkInDate}</TableCell>
                            <TableCell>{formatCurrency(b.monthlyRent)}</TableCell>
                            <TableCell>
                              <Select value={b.status} onValueChange={(v) => handleStatusChange(b.id, v)}>
                                <SelectTrigger className="h-7 w-[130px] text-xs p-0 border-0 bg-transparent">
                                  <StatusPill tone={statusTone(b.status)}>{STATUS_LABELS[b.status] ?? b.status}</StatusPill>
                                </SelectTrigger>
                                <SelectContent>
                                  {groups.filter((s) => s !== "all").map((s) => (
                                    <SelectItem key={s} value={s}>
                                      {STATUS_LABELS[s]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}
