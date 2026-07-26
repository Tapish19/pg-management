import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });

function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Organization, payments, notifications & roles." />
      <Tabs defaultValue="org">
        <TabsList>
          <TabsTrigger value="org">Organization</TabsTrigger>
          <TabsTrigger value="rent">Rent rules</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="notify">Notifications</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
        </TabsList>
        <TabsContent value="org" className="mt-4">
          <Card className="p-6 max-w-2xl space-y-4">
            <div>
              <Label className="mb-1.5 block">Organization name</Label>
              <Input defaultValue="PG One Bengaluru" />
            </div>
            <div>
              <Label className="mb-1.5 block">Contact email</Label>
              <Input defaultValue="admin@pgone.demo" />
            </div>
            <div>
              <Label className="mb-1.5 block">GST number (optional)</Label>
              <Input placeholder="29ABCDE1234F1Z5" />
            </div>
            <Button>Save changes</Button>
          </Card>
        </TabsContent>
        <TabsContent value="rent" className="mt-4">
          <Card className="p-6 max-w-2xl space-y-4">
            <div>
              <Label className="mb-1.5 block">Rent due day of month</Label>
              <Input type="number" defaultValue={5} />
            </div>
            <div>
              <Label className="mb-1.5 block">Late fee (₹/day)</Label>
              <Input type="number" defaultValue={100} />
            </div>
            <div>
              <Label className="mb-1.5 block">Notice period (days)</Label>
              <Input type="number" defaultValue={30} />
            </div>
            <Button>Save changes</Button>
          </Card>
        </TabsContent>
        <TabsContent value="payments" className="mt-4">
          <Card className="p-6 max-w-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Cash</div>
                <div className="text-xs text-muted-foreground">Accept manual cash entries</div>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">UPI</div>
                <div className="text-xs text-muted-foreground">Show UPI ID at checkout</div>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Razorpay</div>
                <div className="text-xs text-muted-foreground">Add live API keys to enable</div>
              </div>
              <Button size="sm" variant="outline">
                Connect
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Stripe</div>
                <div className="text-xs text-muted-foreground">For international cards</div>
              </div>
              <Button size="sm" variant="outline">
                Connect
              </Button>
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="notify" className="mt-4">
          <Card className="p-6 max-w-2xl space-y-4">
            {[
              "Rent due reminders",
              "Payment received",
              "New bookings",
              "Complaint updates",
              "Visitor check-ins",
            ].map((n) => (
              <div key={n} className="flex items-center justify-between">
                <div className="font-medium">{n}</div>
                <Switch defaultChecked />
              </div>
            ))}
          </Card>
        </TabsContent>
        <TabsContent value="roles" className="mt-4">
          <Card className="p-6 space-y-3 max-w-2xl">
            {[
              ["Owner / Admin", "Full access"],
              ["Manager", "Property operations, no financial edits"],
              ["Staff", "Assigned property tasks & complaints"],
              ["Tenant", "Own room, rent, food, complaints"],
            ].map(([r, d]) => (
              <div key={r} className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <div className="font-medium">{r}</div>
                  <div className="text-xs text-muted-foreground">{d}</div>
                </div>
                <Button size="sm" variant="outline">
                  Edit
                </Button>
              </div>
            ))}
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
