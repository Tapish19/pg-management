import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PROPERTIES, ROOMS, formatCurrency } from "@/lib/demo-data";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, ArrowLeft, ArrowRight, CheckCircle2, Upload } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/book/$id")({
  loader: ({ params }) => {
    const p = PROPERTIES.find((x) => x.id === params.id);
    if (!p) throw notFound();
    return { property: p };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `Book — ${loaderData?.property.name ?? "PG"} — PG One` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BookingFlow,
  notFoundComponent: () => (
    <div className="p-10 text-center">
      PG not found.{" "}
      <Link to="/browse" className="text-primary underline">
        Browse
      </Link>
    </div>
  ),
});

const STEPS = ["Room", "Date", "Details", "Add-ons", "Summary", "Payment", "Confirmed"] as const;

function BookingFlow() {
  const { property } = Route.useLoaderData();
  const navigate = useNavigate();
  const rooms = ROOMS.filter(
    (r) => r.propertyId === property.id && r.status !== "occupied" && r.status !== "maintenance",
  );
  const [step, setStep] = useState(0);
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "");
  const [moveIn, setMoveIn] = useState("");
  const [months, setMonths] = useState("6");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [guardian, setGuardian] = useState("");
  const [foodPlan, setFoodPlan] = useState("all-meals");
  const [method, setMethod] = useState("upi");

  const room = ROOMS.find((r) => r.id === roomId);
  const rent = room?.rent ?? 0;
  const deposit = room?.deposit ?? 0;
  const foodAddon = foodPlan === "all-meals" ? 2500 : foodPlan === "dinner-only" ? 1200 : 0;
  const total = rent + deposit + foodAddon;

  const next = () => {
    if (step === 0 && !roomId) return toast.error("Select a room");
    if (step === 1 && !moveIn) return toast.error("Pick move-in date");
    if (step === 2 && (!name || !phone)) return toast.error("Enter name and phone");
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="border-b bg-background sticky top-0 z-30">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 h-16 flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/pg/$id" params={{ id: property.id }}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
          </Button>
          <div className="flex-1 text-sm font-medium truncate">{property.name}</div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl p-4 sm:p-6">
        <div className="mb-6 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <div
                  className={`grid h-7 w-7 place-items-center rounded-full text-xs font-semibold ${i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                >
                  {i + 1}
                </div>
                <div
                  className={`text-xs ${i === step ? "text-foreground font-medium" : "text-muted-foreground"}`}
                >
                  {label}
                </div>
                {i < STEPS.length - 1 && <div className="h-px w-6 bg-border" />}
              </div>
            ))}
          </div>
        </div>

        <Card className="p-6">
          {step === 0 && (
            <>
              <h2 className="text-xl font-semibold mb-4">Choose a room</h2>
              <RadioGroup
                value={roomId}
                onValueChange={setRoomId}
                className="grid gap-3 sm:grid-cols-2"
              >
                {rooms.map((r) => (
                  <label
                    key={r.id}
                    className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer ${roomId === r.id ? "border-primary bg-accent/30" : ""}`}
                  >
                    <RadioGroupItem value={r.id} className="mt-1" />
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <div className="font-semibold">Room {r.number}</div>
                        <Badge variant="outline">{r.sharing}-sharing</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Floor {r.floor} · {r.ac ? "AC" : "Non-AC"}
                      </div>
                      <div className="mt-2 text-sm">
                        {formatCurrency(r.rent)}
                        <span className="text-muted-foreground">/mo</span>
                      </div>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </>
          )}
          {step === 1 && (
            <>
              <h2 className="text-xl font-semibold mb-4">Move-in date & duration</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="mb-1.5 block">Move-in date</Label>
                  <Input type="date" value={moveIn} onChange={(e) => setMoveIn(e.target.value)} />
                </div>
                <div>
                  <Label className="mb-1.5 block">Duration</Label>
                  <Select value={months} onValueChange={setMonths}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 months</SelectItem>
                      <SelectItem value="6">6 months</SelectItem>
                      <SelectItem value="12">12 months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <h2 className="text-xl font-semibold mb-4">Tenant details</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="mb-1.5 block">Full name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label className="mb-1.5 block">Phone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div>
                  <Label className="mb-1.5 block">Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label className="mb-1.5 block">Guardian / Emergency contact</Label>
                  <Input value={guardian} onChange={(e) => setGuardian(e.target.value)} />
                </div>
              </div>
              <div className="mt-4 rounded-lg border-2 border-dashed p-6 text-center">
                <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
                <div className="text-sm mt-2">Upload KYC document</div>
                <div className="text-xs text-muted-foreground">
                  Aadhaar / PAN / Passport · Placeholder
                </div>
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <h2 className="text-xl font-semibold mb-4">Add-ons & food plan</h2>
              <RadioGroup
                value={foodPlan}
                onValueChange={setFoodPlan}
                className="grid gap-3 sm:grid-cols-3"
              >
                {[
                  {
                    id: "all-meals",
                    label: "All meals",
                    price: 2500,
                    desc: "Breakfast + Lunch + Dinner",
                  },
                  { id: "dinner-only", label: "Dinner only", price: 1200, desc: "Weekday dinners" },
                  { id: "none", label: "No plan", price: 0, desc: "I'll manage meals myself" },
                ].map((f) => (
                  <label
                    key={f.id}
                    className={`rounded-lg border p-4 cursor-pointer ${foodPlan === f.id ? "border-primary bg-accent/30" : ""}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="font-semibold">{f.label}</div>
                      <RadioGroupItem value={f.id} />
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{f.desc}</div>
                    <div className="mt-2 font-medium">
                      {f.price === 0 ? "Free" : `${formatCurrency(f.price)}/mo`}
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </>
          )}
          {step === 4 && (
            <>
              <h2 className="text-xl font-semibold mb-4">Price summary</h2>
              <div className="space-y-2 text-sm">
                <Row
                  label={`Room ${room?.number} · ${room?.sharing}-sharing`}
                  value={formatCurrency(rent)}
                />
                <Row label="Security deposit (refundable)" value={formatCurrency(deposit)} />
                <Row
                  label={`Food plan (${foodPlan})`}
                  value={foodAddon ? formatCurrency(foodAddon) : "—"}
                />
                <div className="border-t pt-3 mt-3 flex justify-between font-semibold text-base">
                  <span>Total due at booking</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </>
          )}
          {step === 5 && (
            <>
              <h2 className="text-xl font-semibold mb-4">Payment method</h2>
              <RadioGroup
                value={method}
                onValueChange={setMethod}
                className="grid gap-2 sm:grid-cols-2"
              >
                {[
                  { id: "upi", label: "UPI", desc: "PhonePe / GPay / Paytm" },
                  { id: "card", label: "Card", desc: "Debit / credit" },
                  { id: "bank", label: "Bank transfer", desc: "NEFT / IMPS" },
                  { id: "cash", label: "Cash on move-in", desc: "Pay at property" },
                ].map((m) => (
                  <label
                    key={m.id}
                    className={`rounded-lg border p-4 cursor-pointer ${method === m.id ? "border-primary bg-accent/30" : ""}`}
                  >
                    <div className="flex justify-between">
                      <div className="font-semibold">{m.label}</div>
                      <RadioGroupItem value={m.id} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{m.desc}</div>
                  </label>
                ))}
              </RadioGroup>
              <div className="mt-4 rounded-lg border p-3 text-xs text-muted-foreground bg-muted/40">
                Integrations ready: Razorpay & Stripe. Add API keys in settings to enable live
                gateway.
              </div>
            </>
          )}
          {step === 6 && (
            <div className="text-center py-8">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success text-success-foreground">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2 className="text-2xl font-bold mt-4">Booking confirmed!</h2>
              <p className="text-muted-foreground mt-2">
                Reference:{" "}
                <span className="font-mono">B-{Math.floor(Math.random() * 9000 + 1000)}</span>
              </p>
              <Card className="mt-6 p-5 text-left max-w-md mx-auto">
                <Row label="Property" value={property.name} />
                <Row label="Room" value={`Room ${room?.number}`} />
                <Row label="Move-in" value={moveIn || "—"} />
                <Row label="Duration" value={`${months} months`} />
                <div className="border-t pt-2 mt-2 flex justify-between font-semibold">
                  <span>Amount</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </Card>
              <div className="mt-6 flex gap-2 justify-center">
                <Button variant="outline" asChild>
                  <Link to="/browse">Browse more</Link>
                </Button>
                <Button onClick={() => navigate({ to: "/auth" })}>Go to dashboard</Button>
              </div>
            </div>
          )}

          {step < 6 && (
            <div className="mt-8 flex justify-between">
              <Button variant="ghost" onClick={back} disabled={step === 0}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button onClick={next}>
                {step === 5 ? "Pay & confirm" : "Continue"}
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
