import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/app-shell";
import { formatCurrency } from "@/lib/demo-data";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard, StatusPill, statusTone } from "@/components/ui-ext/stat";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Wallet, AlertTriangle, CheckCircle2, Clock, Download } from "lucide-react";
import { listOwnerPayments } from "@/lib/api/functions/payments-fns";

export const Route = createFileRoute("/_app/payments")({ component: PaymentsPage });

function PaymentsPage() {
  const { data: paymentsList, isLoading } = useQuery({
    queryKey: ["payments", "mine"],
    queryFn: () => listOwnerPayments(),
  });

  const rows = paymentsList || [];
  const paid = rows.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const pending = rows.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0);
  const failed = rows.filter((p) => p.status === "failed").reduce((s, p) => s + p.amount, 0);
  const deposits = rows
    .filter((p) => p.type === "deposit" && p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);

  const groups = ["all", "pending", "paid", "failed", "refunded"];

  return (
    <>
      <PageHeader
        title="Rent & Payments"
        description="Invoices, dues and collections."
        actions={
          <Button variant="outline">
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard label="Collected" value={formatCurrency(paid)} icon={CheckCircle2} tone="success" />
        <StatCard label="Pending" value={formatCurrency(pending)} icon={Clock} tone="info" />
        <StatCard label="Failed" value={formatCurrency(failed)} icon={AlertTriangle} tone="destructive" />
        <StatCard label="Deposits held" value={formatCurrency(deposits)} icon={Wallet} />
      </div>
      <Tabs defaultValue="all">
        <TabsList>
          {groups.map((g) => (
            <TabsTrigger key={g} value={g} className="capitalize">
              {g}
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
                      <TableHead>Payment</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Month</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Paid at</TableHead>
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
                    ) : rows.filter((p) => g === "all" || p.status === g).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No payments here yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows
                        .filter((p) => g === "all" || p.status === g)
                        .map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-mono text-xs">{p.id}</TableCell>
                            <TableCell className="font-medium">{p.tenant?.name ?? "—"}</TableCell>
                            <TableCell className="capitalize">{p.type}</TableCell>
                            <TableCell>{p.month ?? "—"}</TableCell>
                            <TableCell>{formatCurrency(p.amount)}</TableCell>
                            <TableCell>{p.paidAt ? new Date(p.paidAt).toLocaleDateString() : "—"}</TableCell>
                            <TableCell>
                              <StatusPill tone={statusTone(p.status)}>{p.status}</StatusPill>
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
      <Card className="mt-6 p-5 bg-muted/40">
        <div className="font-semibold">Payment gateway</div>
        <p className="text-sm text-muted-foreground mt-1">
          Razorpay is wired in on the backend — tenants pay from Pay Rent and orders/payments are
          recorded here automatically once keys are set in your .env file.
        </p>
      </Card>
    </>
  );
}
