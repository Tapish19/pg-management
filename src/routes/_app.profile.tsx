import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";
import { Upload, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/profile")({ component: ProfilePage });

function ProfilePage() {
  const { user } = useAuth();
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
          <div className="mt-6 space-y-3">
            <div>
              <Label className="mb-1.5 block">Full name</Label>
              <Input defaultValue={user.name} />
            </div>
            <div>
              <Label className="mb-1.5 block">Email</Label>
              <Input type="email" defaultValue={user.email} />
            </div>
            <div>
              <Label className="mb-1.5 block">Phone</Label>
              <Input defaultValue={user.phone} />
            </div>
            <Button onClick={() => toast.success("Profile updated")}>Save changes</Button>
          </div>
        </Card>

        <Card className="p-6">
          <div className="font-semibold mb-3">KYC documents</div>
          {[
            { name: "Aadhaar card", status: "verified" },
            { name: "PAN card", status: "verified" },
            { name: "Rental agreement", status: "pending" },
          ].map((d) => (
            <div
              key={d.name}
              className="flex items-center justify-between border rounded-lg p-3 mb-2"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2
                  className={`h-4 w-4 ${d.status === "verified" ? "text-success" : "text-warning"}`}
                />
                <span className="text-sm font-medium">{d.name}</span>
              </div>
              <Badge variant="outline" className="capitalize">
                {d.status}
              </Badge>
            </div>
          ))}
          <div className="rounded-lg border-2 border-dashed p-6 text-center mt-3">
            <Upload className="h-5 w-5 mx-auto text-muted-foreground" />
            <div className="text-sm mt-2">Upload new document</div>
            <div className="text-xs text-muted-foreground">JPG, PNG or PDF — up to 5 MB</div>
          </div>
        </Card>
      </div>
    </>
  );
}
