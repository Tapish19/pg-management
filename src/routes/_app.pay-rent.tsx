import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/app-shell";
import { formatCurrency } from "@/lib/demo-data";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusPill, statusTone } from "@/components/ui-ext/stat";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { getMyBooking, getMyPayments } from "@/lib/demo-api";
import { createPaymentOrder, verifyPayment } from "@/lib/demo-api";
import { rentDueDate } from "@/lib/owner-settings";
import { useAuth } from "@/lib/auth";
import { runDemoAction } from "@/lib/demo-sharing";
import { readDemoPaymentMethods, type DemoPaymentMethod } from "@/lib/demo-payment-settings";

export const Route = createFileRoute("/_app/pay-rent")({ component: PayRentPage });

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpayScript() {
  return new Promise<boolean>((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function PayRentPage() {
  const { isDemo } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [demoMethods] = useState(() => {
    const methods = readDemoPaymentMethods();
    return (Object.keys(methods) as DemoPaymentMethod[]).filter((key) => methods[key]);
  });
  const [demoMethod, setDemoMethod] = useState<DemoPaymentMethod | "">(() => demoMethods[0] ?? "");

  const { data: booking, isLoading: bookingLoading } = useQuery({
    queryKey: ["my-booking"],
    queryFn: () => getMyBooking(),
  });
  const { data: paymentHistory, isLoading: paymentsLoading } = useQuery({
    queryKey: ["my-payments"],
    queryFn: () => getMyPayments(),
  });

  const amount = booking?.booking?.monthlyRent ?? 0;
  const rentMonth = new Date().toISOString().slice(0, 7);
  const eligible = !!booking?.booking && ["active", "confirmed"].includes(booking.booking.status);
  const alreadyPaid = (paymentHistory ?? []).some(
    (p) =>
      p.bookingId === booking?.booking?.id &&
      p.type === "rent" &&
      p.month === rentMonth &&
      p.status === "paid",
  );

  async function handlePay() {
    if (!booking?.booking || !eligible || alreadyPaid) return;
    setPaying(true);
    try {
      const order = await createPaymentOrder({
        data: {
          bookingId: booking.booking.id,
          amount,
          type: "rent",
          month: rentMonth,
        },
      });

      if (isDemo) {
        await runDemoAction("verifyPayment", {
          paymentId: order.paymentId,
          method: demoMethod,
        });
        setPaid(true);
        toast.success("Demo payment completed. No money was charged.");
        await queryClient.invalidateQueries();
        return;
      }
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || !window.Razorpay) {
        toast.error("Couldn't load the payment widget. Please try again.");
        setPaying(false);
        return;
      }

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "PG One",
        description: "Monthly rent",
        order_id: order.orderId,
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            await verifyPayment({
              data: {
                paymentId: order.paymentId,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              },
            });
            setPaid(true);
            toast.success(`Payment of ${formatCurrency(amount)} successful`);
            queryClient.invalidateQueries({ queryKey: ["my-payments"] });
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Payment verification failed");
          }
        },
        theme: { color: "#059669" },
      });
      rzp.open();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Could not start payment. Ask your PG owner to configure Razorpay keys.",
      );
    } finally {
      setPaying(false);
    }
  }

  if (bookingLoading) {
    return <PageHeader title="Pay Rent" description="Loading…" />;
  }

  if (!booking?.booking) {
    return (
      <>
        <PageHeader title="Pay Rent" description="No active booking found on your account." />
        <Card className="p-6 text-sm text-muted-foreground">
          Once your booking is confirmed, you'll be able to pay rent here.
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Pay Rent" description="Clear dues and view your payment history." />
      {isDemo && (
        <p className="mb-4 text-sm text-muted-foreground">
          Demo payments are simulated. No money is charged.
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <Card className="p-5 mb-4">
            <div className="flex justify-between items-start flex-wrap gap-4">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">
                  Monthly rent
                </div>
                <div className="text-3xl font-bold mt-1">{formatCurrency(amount)}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Room {booking.room?.roomNumber} · {booking.property?.name}
                </div>
              </div>
              <Dialog
                open={open}
                onOpenChange={(v) => {
                  setOpen(v);
                  if (!v) setPaid(false);
                }}
              >
                <DialogTrigger asChild>
                  <Button
                    size="lg"
                    disabled={
                      !eligible ||
                      alreadyPaid ||
                      paymentsLoading ||
                      !paymentHistory ||
                      (isDemo && !demoMethods.length)
                    }
                  >
                    {alreadyPaid
                      ? "Paid this month"
                      : eligible
                        ? `Pay ${formatCurrency(amount)}`
                        : "Awaiting booking confirmation"}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Complete payment</DialogTitle>
                  </DialogHeader>
                  {!paid ? (
                    <div className="space-y-4">
                      {isDemo && (
                        <label className="block text-sm font-medium">
                          Demo payment method
                          <select
                            aria-label="Demo payment method"
                            value={demoMethod}
                            onChange={(e) => setDemoMethod(e.target.value as DemoPaymentMethod)}
                            className="block mt-2 w-full rounded-md border bg-background p-2"
                          >
                            {demoMethods.map((method) => (
                              <option key={method} value={method}>
                                {method === "upi"
                                  ? "UPI"
                                  : method.charAt(0).toUpperCase() + method.slice(1)}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {isDemo
                          ? "Complete a simulated rent payment. No checkout account is needed and no money will be charged."
                          : "You'll be redirected to Razorpay's secure checkout to pay via UPI, card, or netbanking."}
                      </p>
                      <Button
                        className="w-full"
                        disabled={paying || !eligible || alreadyPaid || paymentsLoading}
                        onClick={handlePay}
                      >
                        {paying ? "Starting…" : `Pay ${formatCurrency(amount)}`}
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <CheckCircle2 className="h-12 w-12 text-success mx-auto" />
                      <div className="font-semibold mt-2">Payment successful</div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          </Card>

          {isDemo && !demoMethods.length && (
            <p role="alert" className="mb-4 text-sm text-muted-foreground">
              The owner has disabled all demo payment methods. Switch to Owner / Admin and enable a
              method in Settings → Payments.
            </p>
          )}

          <Card className="overflow-hidden">
            <div className="p-4 border-b font-semibold">Payment history</div>
            <div className="divide-y">
              {paymentsLoading ? (
                <div className="p-6 text-center text-muted-foreground text-sm">Loading…</div>
              ) : (paymentHistory || []).length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  No payments yet.
                </div>
              ) : (
                (paymentHistory || []).map((p) => (
                  <div key={p.id} className="p-4 flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="font-medium capitalize">
                        {p.type} {p.month ? `· ${p.month}` : ""}
                      </div>
                      <div className="text-xs text-muted-foreground">{p.id}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(p.amount)}</div>
                      <StatusPill tone={statusTone(p.status)}>{p.status}</StatusPill>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <Card className="p-5 h-fit">
          <div className="font-semibold mb-3">Booking summary</div>
          <div className="space-y-1.5 text-sm">
            <Row l="Monthly rent" v={formatCurrency(booking.booking.monthlyRent)} />
            <Row l="Deposit required" v={formatCurrency(booking.booking.depositAmount)} />
            <Row
              l="Deposit paid"
              v={
                paymentsLoading
                  ? "Loading..."
                  : formatCurrency(
                      (paymentHistory ?? [])
                        .filter(
                          (p) =>
                            p.bookingId === booking.booking.id &&
                            p.type === "deposit" &&
                            p.status === "paid",
                        )
                        .reduce((sum, p) => sum + p.amount, 0),
                    )
              }
            />
            <Row l="Move-in" v={booking.booking.checkInDate} />
            {booking.policy && (
              <>
                <Row l="Rent due" v={rentDueDate(rentMonth, booking.policy.dueDay)} />
                <Row
                  l="Late fee policy"
                  v={`${formatCurrency(booking.policy.lateFeePerDay)}/day`}
                />
                <Row l="Notice period" v={`${booking.policy.noticePeriodDays} days`} />
                <Row l="Organization" v={booking.policy.organizationName} />
                <a
                  className="block text-primary underline"
                  href={`mailto:${booking.policy.contactEmail}`}
                >
                  Contact your PG owner
                </a>
                <p className="text-xs text-muted-foreground">
                  Late fees are collected separately from monthly rent.
                </p>
              </>
            )}
          </div>
          <Badge variant="secondary" className="mt-3">
            Booking status: {booking.booking.status}
          </Badge>
        </Card>
      </div>
    </>
  );
}

function Row({ l, v }: { l: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{l}</span>
      <span>{v}</span>
    </div>
  );
}
