import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Building2,
  Search,
  Wifi,
  UtensilsCrossed,
  ShieldCheck,
  Sparkles,
  Wallet,
  Users,
  BarChart3,
  ArrowRight,
  Star,
  Check,
  MapPin,
  BedDouble,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PROPERTIES, REVIEWS, FAQS, formatCurrency } from "@/lib/demo-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PG One — Find, Book & Manage PGs" },
      {
        name: "description",
        content:
          "Discover premium PGs, book a bed in minutes, and manage your property end-to-end. Built for owners, staff and residents.",
      },
    ],
  }),
  component: Landing,
});

function TopNav() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto max-w-7xl h-16 px-4 sm:px-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground font-display font-semibold rotate-[-4deg] shadow-[0_1px_0_0_var(--color-border)]">
            PG
          </div>
          <span className="font-display font-semibold tracking-tight text-lg">PG One</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm">
          <Link to="/browse" className="text-muted-foreground hover:text-foreground">
            Browse rooms
          </Link>
          <a href="#features" className="text-muted-foreground hover:text-foreground">
            For owners
          </a>
          <a href="#faq" className="text-muted-foreground hover:text-foreground">
            FAQ
          </a>
          <a href="#contact" className="text-muted-foreground hover:text-foreground">
            Contact
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/auth">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/browse">Find a PG</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-0 -z-10 opacity-[0.05]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(-45deg, var(--ink) 0, var(--ink) 1px, transparent 1px, transparent 14px)",
        }}
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-24 lg:py-28">
        <div className="max-w-3xl">
          <div className="keytag keytag--filled mb-5">
            <Sparkles className="h-3 w-3" /> now handing out keys in 3 cities
          </div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.75rem] font-semibold tracking-tight leading-[1.05]">
            Find a room, get the keys,{" "}
            <span className="relative whitespace-nowrap">
              <span className="relative z-10">move in.</span>
              <span className="absolute inset-x-0 bottom-1.5 h-3 -z-0 bg-primary/50" />
            </span>
          </h1>
          <p className="mt-5 text-lg text-muted-foreground max-w-2xl">
            Every listing here comes with a real room, a real rent number and a real key tag —
            no brokers, no "call for price." Owners run the whole PG — rent, staff, food,
            complaints — from the same place.
          </p>
        </div>
        <Card className="ticket-edge mt-10 p-4 sm:p-5 border-dashed">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="City or area (e.g. HSR Layout)" />
            </div>
            <div className="relative">
              <BedDouble className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Sharing type (1, 2, 3, 4)" />
            </div>
            <div className="relative">
              <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Budget (max ₹)" />
            </div>
            <Button asChild size="lg" className="gap-2">
              <Link to="/browse">
                <Search className="h-4 w-4" />
                Search
              </Link>
            </Button>
          </div>
        </Card>
        <div className="mt-6 flex flex-wrap gap-2.5">
          {["Verified listings", "Zero brokerage", "Free cancellation", "24×7 support"].map((t) => (
            <span key={t} className="keytag">
              <Check className="h-3 w-3" />
              {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Featured() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 py-16">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">
            Featured PGs
          </h2>
          <p className="text-muted-foreground mt-1">Handpicked properties with the best reviews.</p>
        </div>
        <Link
          to="/browse"
          className="text-sm text-primary hover:underline inline-flex items-center gap-1"
        >
          View all <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {PROPERTIES.map((p) => (
          <Link key={p.id} to="/pg/$id" params={{ id: p.id }} className="group">
            <Card className="overflow-hidden pt-0 h-full transition-shadow hover:shadow-elegant">
              <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                <img
                  src={p.image}
                  alt={p.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
                <div className="keytag keytag--filled absolute top-3 left-3">
                  {formatCurrency(p.rentFrom)}/mo
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold truncate">{p.name}</h3>
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                    {p.rating}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">
                  {p.area}, {p.city}
                </div>
                <div className="mt-3">
                  <span className="keytag capitalize">{p.gender}</span>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Amenities() {
  const items = [
    { icon: Wifi, label: "High-speed WiFi" },
    { icon: UtensilsCrossed, label: "Home-style meals" },
    { icon: ShieldCheck, label: "24×7 security" },
    { icon: Sparkles, label: "Daily housekeeping" },
    { icon: BedDouble, label: "Furnished rooms" },
    { icon: Building2, label: "Prime locations" },
  ];
  return (
    <section className="bg-secondary/40 border-y">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-14">
        <h2 className="font-display text-center text-2xl sm:text-3xl font-semibold tracking-tight">
          Everything you'd want in a PG
        </h2>
        <p className="text-center text-muted-foreground mt-2 max-w-xl mx-auto">
          Every listing includes the essentials, so you can focus on settling in.
        </p>
        <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {items.map((i) => (
            <div key={i.label} className="rounded-xl border bg-card p-5 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent text-accent-foreground">
                <i.icon className="h-5 w-5" />
              </div>
              <div className="mt-3 text-sm font-medium">{i.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ForOwners() {
  const features = [
    {
      icon: Wallet,
      title: "Automated rent & invoicing",
      body: "Auto-generate invoices, track paid/partial/overdue, and send reminders.",
    },
    {
      icon: Users,
      title: "Tenant & staff management",
      body: "Onboard tenants with KYC, assign rooms, manage staff shifts and salaries.",
    },
    {
      icon: BarChart3,
      title: "Live occupancy & analytics",
      body: "Charts for occupancy, revenue vs expense, booking funnel and food usage.",
    },
    {
      icon: ShieldCheck,
      title: "Complaints & maintenance",
      body: "SLA-tracked tickets with priority, assignment and status history.",
    },
  ];
  return (
    <section id="features" className="mx-auto max-w-7xl px-4 sm:px-6 py-16">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <Badge variant="secondary" className="mb-3">
            For owners
          </Badge>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
            Run it like a business, not a group chat.
          </h2>
          <p className="mt-3 text-muted-foreground">
            PG One replaces the WhatsApp group, the rent notebook and the loose visitor register
            with one dashboard — built from the actual paperwork of running a PG.
          </p>
          <div className="mt-6 flex gap-3">
            <Button asChild>
              <Link to="/auth">Try the demo</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/browse">See sample PGs</Link>
            </Button>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {features.map((f) => (
            <Card key={f.title} className="p-5">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <div className="mt-3 font-semibold">{f.title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section className="bg-secondary/40 border-y">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16">
        <h2 className="font-display text-center text-2xl sm:text-3xl font-semibold tracking-tight">
          Loved by residents
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {REVIEWS.map((r) => (
            <Card key={r.name} className="p-5">
              <div className="flex gap-0.5 text-warning">
                {Array.from({ length: r.rating }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-warning" />
                ))}
              </div>
              <p className="mt-3 text-sm">"{r.text}"</p>
              <div className="mt-4 text-xs font-tag text-muted-foreground">{r.name}</div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
      <h2 className="font-display text-center text-2xl sm:text-3xl font-semibold tracking-tight">
        Frequently asked
      </h2>
      <Accordion type="single" collapsible className="mt-8">
        {FAQS.map((f, i) => (
          <AccordionItem key={i} value={`i-${i}`}>
            <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

function Contact() {
  return (
    <section id="contact" className="mx-auto max-w-7xl px-4 sm:px-6 py-16">
      <Card className="p-8 sm:p-12 bg-gradient-to-br from-primary/15 via-accent/40 to-background text-center">
        <h2 className="font-display text-3xl font-semibold tracking-tight">List your PG on PG One</h2>
        <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
          Join hundreds of owners running smoother operations. Setup takes under 10 minutes.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button size="lg" asChild>
            <Link to="/auth">Start free trial</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href="mailto:hello@pgone.demo">Talk to sales</a>
          </Button>
        </div>
      </Card>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
        <div>© {new Date().getFullYear()} PG One. Built for modern PG owners.</div>
        <div className="flex gap-4">
          <Link to="/browse" className="hover:text-foreground">
            Browse
          </Link>
          <Link to="/auth" className="hover:text-foreground">
            Sign in
          </Link>
          <a href="#contact" className="hover:text-foreground">
            Contact
          </a>
        </div>
      </div>
    </footer>
  );
}

function Landing() {
  return (
    <>
      <TopNav />
      <Hero />
      <Featured />
      <Amenities />
      <ForOwners />
      <Testimonials />
      <FAQ />
      <Contact />
      <Footer />
    </>
  );
}
