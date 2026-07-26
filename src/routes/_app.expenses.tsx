import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { StatCard, StatusPill, statusTone } from "@/components/ui-ext/stat";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Receipt, Plus } from "lucide-react";
import { listOwnerExpenses, createExpense, updateExpenseStatus } from "@/lib/api/functions/expenses-fns";
import { listProperties } from "@/lib/api/functions/properties-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/expenses")({ component: ExpensesPage });

function formatCurrency(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

function ExpensesPage() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: expenseList, isLoading } = useQuery({
    queryKey: ["expenses", "mine"],
    queryFn: () => listOwnerExpenses(),
  });

  const { data: properties } = useQuery({
    queryKey: ["properties", "mine"],
    queryFn: () => listProperties(),
  });

  const total = (expenseList || []).reduce((s, e) => s + e.amount, 0);
  const pending = (expenseList || []).filter((e) => e.status === "pending").reduce((s, e) => s + e.amount, 0);

  async function handleStatusChange(id: string, status: string) {
    try {
      await updateExpenseStatus({ data: { id, status: status as any } });
      queryClient.invalidateQueries({ queryKey: ["expenses", "mine"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update expense");
    }
  }

  return (
    <>
      <PageHeader
        title="Expenses"
        description="Track spending across categories."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button disabled={!properties || properties.length === 0}>
                <Plus className="h-4 w-4 mr-1" />
                Add expense
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add an expense</DialogTitle>
              </DialogHeader>
              <NewExpenseForm
                properties={properties || []}
                onCreated={() => {
                  setOpen(false);
                  queryClient.invalidateQueries({ queryKey: ["expenses", "mine"] });
                }}
              />
            </DialogContent>
          </Dialog>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard label="Total this month" value={formatCurrency(total)} icon={Receipt} />
        <StatCard label="Pending approval" value={formatCurrency(pending)} tone="warning" />
        <StatCard label="Entries" value={expenseList?.length ?? 0} />
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : !expenseList || expenseList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No expenses logged yet.
                  </TableCell>
                </TableRow>
              ) : (
                expenseList.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">{e.id}</TableCell>
                    <TableCell className="capitalize">{e.category}</TableCell>
                    <TableCell>{e.vendor}</TableCell>
                    <TableCell>{e.date}</TableCell>
                    <TableCell>{formatCurrency(e.amount)}</TableCell>
                    <TableCell>
                      <Select value={e.status} onValueChange={(v) => handleStatusChange(e.id, v)}>
                        <SelectTrigger className="h-7 w-[120px] text-xs p-0 border-0 bg-transparent">
                          <StatusPill tone={statusTone(e.status)}>{e.status}</StatusPill>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
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
    </>
  );
}

function NewExpenseForm({
  properties,
  onCreated,
}: {
  properties: { id: string; name: string }[];
  onCreated: () => void;
}) {
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [category, setCategory] = useState<
    "utilities" | "salary" | "food" | "maintenance" | "supplies" | "misc"
  >("misc");
  const [vendor, setVendor] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createExpense({ data: { propertyId, category, vendor, date, amount: Number(amount) } });
      toast.success("Expense added");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add expense");
    } finally {
      setSubmitting(false);
    }
  }

  if (properties.length === 0) {
    return <p className="text-sm text-muted-foreground">Add a property first, then come back to log expenses.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <Label className="mb-1.5 block">Property</Label>
        <Select value={propertyId} onValueChange={setPropertyId}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {properties.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5 block">Category</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="utilities">Utilities</SelectItem>
              <SelectItem value="salary">Salary</SelectItem>
              <SelectItem value="food">Food</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="supplies">Supplies</SelectItem>
              <SelectItem value="misc">Misc</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block">Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5 block">Vendor</Label>
          <Input value={vendor} onChange={(e) => setVendor(e.target.value)} required />
        </div>
        <div>
          <Label className="mb-1.5 block">Amount (₹)</Label>
          <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Adding…" : "Add expense"}
      </Button>
    </form>
  );
}
