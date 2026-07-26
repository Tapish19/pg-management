import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import type { Role } from "@/lib/demo-data";
import { Building2, User, ShieldCheck, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — PG One" },
      {
        name: "description",
        content: "Sign in to PG One. Preview Admin, Staff or Tenant dashboards with one click.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { loginAs, loginReal, signupReal, loginTenantReal } = useAuth();
  const navigate = useNavigate();
  const [audience, setAudience] = useState<"owner" | "resident">("owner");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (audience === "resident") {
      if (!email || !phone) {
        toast.error("Enter the email and phone from your booking");
        return;
      }
      setSubmitting(true);
      try {
        await loginTenantReal(email, phone);
        toast.success("Signed in");
        navigate({ to: "/dashboard" });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Sign in failed");
      } finally {
        setSubmitting(false);
      }
      return;
    }
    if (!email || !password) {
      toast.error("Enter email and password");
      return;
    }
    setSubmitting(true);
    try {
      await loginReal(email, password);
      toast.success("Signed in");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      toast.error("Fill in all fields");
      return;
    }
    setSubmitting(true);
    try {
      await signupReal(name, email, password);
      toast.success("Account created");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setSubmitting(false);
    }
  };

  const demo = (role: Role) => {
    loginAs(role);
    toast.success(`Signed in as ${role} (demo)`);
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-10 bg-gradient-to-br from-primary/15 via-accent/50 to-background relative">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground font-bold">
            PG
          </div>
          <span className="font-semibold text-lg">PG One</span>
        </Link>
        <div>
          <h2 className="text-4xl font-bold tracking-tight">
            Everything to run your PG, in one place.
          </h2>
          <p className="mt-4 text-muted-foreground max-w-md">
            Bookings, rent, food, complaints, staff — a premium dashboard for owners, a simple app
            for residents.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3 max-w-md">
            {[
              ["24", "Properties"],
              ["1.2K", "Beds"],
              ["₹5.1L", "Monthly GMV"],
            ].map(([n, l]) => (
              <div key={l} className="rounded-lg border bg-card/70 backdrop-blur p-3">
                <div className="text-xl font-bold">{n}</div>
                <div className="text-xs text-muted-foreground">{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="text-xs text-muted-foreground">© {new Date().getFullYear()} PG One</div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-6">
            <Link to="/" className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground font-bold">
                PG
              </div>
              <span className="font-semibold text-lg">PG One</span>
            </Link>
          </div>

          <Card className="p-6 sm:p-8 mb-4 border-primary/30 bg-accent/30">
            <div className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">
              One-click demo
            </div>
            <div className="grid gap-2">
              {[
                {
                  role: "admin" as Role,
                  label: "Owner / Admin",
                  desc: "Full analytics & operations",
                  icon: ShieldCheck,
                },
                {
                  role: "staff" as Role,
                  label: "Staff",
                  desc: "Tasks, complaints, visitors",
                  icon: Building2,
                },
                {
                  role: "tenant" as Role,
                  label: "Tenant",
                  desc: "Room, rent, food, complaints",
                  icon: User,
                },
              ].map(({ role, label, desc, icon: Icon }) => (
                <button
                  key={role}
                  onClick={() => demo(role)}
                  className="group flex items-center gap-3 rounded-lg border bg-card p-3 text-left hover:border-primary hover:shadow-sm transition"
                >
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{label}</div>
                    <div className="text-xs text-muted-foreground">{desc}</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-6 sm:p-8">
            <div className="grid grid-cols-2 gap-2 mb-6 rounded-lg bg-muted p-1">
              <button
                type="button"
                onClick={() => setAudience("owner")}
                className={`rounded-md py-1.5 text-sm font-medium transition ${
                  audience === "owner" ? "bg-card shadow-sm" : "text-muted-foreground"
                }`}
              >
                Owner / Admin
              </button>
              <button
                type="button"
                onClick={() => setAudience("resident")}
                className={`rounded-md py-1.5 text-sm font-medium transition ${
                  audience === "resident" ? "bg-card shadow-sm" : "text-muted-foreground"
                }`}
              >
                Resident
              </button>
            </div>
            <Tabs defaultValue="signin">
              <TabsList className={`grid mb-6 ${audience === "owner" ? "grid-cols-2" : "grid-cols-1"}`}>
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                {audience === "owner" && <TabsTrigger value="signup">Create account</TabsTrigger>}
              </TabsList>
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <Label className="mb-1.5 block">Email</Label>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  {audience === "owner" ? (
                    <div>
                      <Label className="mb-1.5 block">Password</Label>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                  ) : (
                    <div>
                      <Label className="mb-1.5 block">Phone number</Label>
                      <Input
                        type="tel"
                        placeholder="The phone number on your booking"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Use the email and phone your PG owner has on file for your booking.
                      </p>
                    </div>
                  )}
                  {audience === "owner" && (
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => toast.info("Reset link sent (demo).")}
                        className="text-xs text-primary hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? "Signing in..." : "Sign in"}
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div>
                    <Label className="mb-1.5 block">Full name</Label>
                    <Input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div>
                    <Label className="mb-1.5 block">Email</Label>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5 block">Password</Label>
                    <Input
                      type="password"
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? "Creating account..." : "Create account"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Creates a real PG owner account — you'll land in your admin dashboard.
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
}
