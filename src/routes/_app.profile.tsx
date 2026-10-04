import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMyKyc } from "@/lib/demo-api";

export const Route = createFileRoute("/_app/profile")({ component: ProfilePage });

function ProfilePage() {
  const { user, isDemo, updateProfile } = useAuth();
  const [details, setDetails] = useState({ name: "", email: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const resident = user?.role === "tenant";
  const kyc = useQuery({
    queryKey: ["my-kyc", user?.id],
    queryFn: () => getMyKyc(),
    enabled: resident,
    refetchInterval: 30_000,
  });
  useEffect(() => {
    if (user) setDetails({ name: user.name, email: user.email, phone: user.phone ?? "" });
  }, [user]);
  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await updateProfile(details);
      toast.success("Profile updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  }
  if (!user) return null;
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);
  return (
    <>
      <PageHeader title="Profile" description="Manage your details and documents." />
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <div className="text-lg font-semibold">{user.name}</div>
              <div className="text-sm text-muted-foreground">{user.email}</div>
              <Badge variant="secondary" className="mt-1 capitalize">
                {user.role}
              </Badge>
            </div>
          </div>
          <form onSubmit={handleSave} className="mt-6 space-y-3">
            <div>
              <Label className="mb-1.5 block">Full name</Label>
              <Input
                required
                minLength={2}
                maxLength={100}
                value={details.name}
                onChange={(e) => setDetails({ ...details, name: e.target.value })}
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Email</Label>
              <Input
                required
                type="email"
                value={details.email}
                onChange={(e) => setDetails({ ...details, email: e.target.value })}
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Phone</Label>
              <Input
                type="tel"
                required={user.role === "tenant"}
                maxLength={30}
                value={details.phone}
                onChange={(e) => setDetails({ ...details, phone: e.target.value })}
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
            {isDemo && (
              <p className="text-sm text-muted-foreground">
                Demo profile changes save on this browser.
              </p>
            )}
          </form>
        </Card>

        <Card className="p-6">
          <div className="font-semibold mb-3">KYC status</div>
          {!resident ? (
            <p className="text-sm text-muted-foreground">
              KYC details are available for resident accounts.
            </p>
          ) : kyc.isLoading ? (
            <p>Loading KYC status…</p>
          ) : kyc.isError ? (
            <div role="alert">
              Could not load KYC status. <Button onClick={() => kyc.refetch()}>Retry</Button>
            </div>
          ) : (
            kyc.data && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    className={
                      kyc.data.status === "verified" ? "text-success" : "text-muted-foreground"
                    }
                  />
                  <Badge variant="outline" className="capitalize">
                    {kyc.data.status}
                  </Badge>
                </div>
                <p className="text-sm">ID proof: {kyc.data.proofType || "Not recorded"}</p>
                <p className="text-sm text-muted-foreground">
                  {kyc.data.hasProofDetails
                    ? "Your ID proof details are recorded with your PG owner."
                    : "Contact your PG owner to submit your ID proof details."}
                </p>
              </div>
            )
          )}
        </Card>
      </div>
    </>
  );
}
