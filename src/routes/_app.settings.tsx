import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { getOwnerSettings, updateOwnerSettings } from "@/lib/api/functions/settings-fns";
import { toast } from "sonner";
import { SampleDataCard } from "@/components/sample-data-card";
import type { NotificationPreferences } from "@/lib/owner-settings";
import {
  defaultNotificationPreferences,
  defaultRentRules,
  organizationSchema,
  rentRulesSchema,
  notificationPreferencesSchema,
} from "@/lib/owner-settings";

type Settings = Awaited<ReturnType<typeof getOwnerSettings>>;
const demoSettingsKey = (id: string) => `pgone.demo.settings.v1.${id}`;
function readDemoSettings(id: string): Settings {
  const defaults: Settings = {
    organizationName: "PG One Demo",
    contactEmail: "admin@pgone.demo",
    gstNumber: "",
    ...defaultRentRules,
    notifications: { ...defaultNotificationPreferences },
  };
  try {
    const saved = JSON.parse(localStorage.getItem(demoSettingsKey(id)) ?? "null");
    if (!saved) return defaults;
    return {
      ...organizationSchema.parse(saved),
      ...rentRulesSchema.parse(saved),
      notifications: notificationPreferencesSchema.parse(saved.notifications),
    };
  } catch {
    return defaults;
  }
}

export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });

function SettingsPage() {
  const { user, isDemo } = useAuth();
  const enabled = user?.role === "admin";
  const query = useQuery({
    queryKey: ["owner-settings", isDemo ? "demo" : "real", user?.id],
    queryFn: () => (isDemo ? readDemoSettings(user!.id) : getOwnerSettings()),
    enabled,
  });
  if (!enabled)
    return (
      <>
        <PageHeader title="Settings" description="Manage your organization." />
        <Card className="p-6">Sign in as an owner to manage settings.</Card>
      </>
    );
  if (query.isLoading) return <PageHeader title="Settings" description="Loading settings…" />;
  if (query.isError || !query.data)
    return (
      <Card className="p-6">
        Could not load settings. <Button onClick={() => query.refetch()}>Retry</Button>
      </Card>
    );
  return (
    <SettingsEditor
      key={`${isDemo ? "demo" : "real"}-${user.id}`}
      initial={query.data}
      demoOwnerId={isDemo ? user.id : undefined}
    />
  );
}

function SettingsEditor({ initial, demoOwnerId }: { initial: Settings; demoOwnerId?: string }) {
  const [settings, setSettings] = useState(initial);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  async function save(section: "organization" | "rent" | "notifications") {
    setSaving(true);
    try {
      if (demoOwnerId) {
        const current = readDemoSettings(demoOwnerId);
        const update =
          section === "organization"
            ? organizationSchema.parse(settings)
            : section === "rent"
              ? rentRulesSchema.parse(settings)
              : { notifications: notificationPreferencesSchema.parse(settings.notifications) };
        localStorage.setItem(
          demoSettingsKey(demoOwnerId),
          JSON.stringify({ ...current, ...update }),
        );
        await queryClient.invalidateQueries({ queryKey: ["owner-settings", "demo", demoOwnerId] });
        toast.success("Demo settings saved on this browser");
        return;
      }
      if (section === "organization")
        await updateOwnerSettings({
          data: {
            section,
            values: {
              organizationName: settings.organizationName,
              contactEmail: settings.contactEmail,
              gstNumber: settings.gstNumber,
            },
          },
        });
      else if (section === "rent")
        await updateOwnerSettings({
          data: {
            section,
            values: {
              dueDay: settings.dueDay,
              lateFeePerDay: settings.lateFeePerDay,
              noticePeriodDays: settings.noticePeriodDays,
            },
          },
        });
      else await updateOwnerSettings({ data: { section, values: settings.notifications } });
      for (const key of ["owner-settings", "owner-notifications", "my-booking"])
        await queryClient.invalidateQueries({ queryKey: [key] });
      toast.success("Settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <PageHeader title="Settings" description="Organization, payments, notifications & roles." />
      {demoOwnerId ? (
        <p className="mb-4 text-sm text-muted-foreground">
          Demo mode: organization, rent rules and notification preferences save on this browser.
        </p>
      ) : (
        <SampleDataCard />
      )}
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
              <Input
                value={settings.organizationName}
                onChange={(e) => setSettings({ ...settings, organizationName: e.target.value })}
                maxLength={120}
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Contact email</Label>
              <Input
                type="email"
                value={settings.contactEmail}
                onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
              />
            </div>
            <div>
              <Label className="mb-1.5 block">GST number (optional)</Label>
              <Input
                placeholder="29ABCDE1234F1Z5"
                maxLength={15}
                value={settings.gstNumber}
                onChange={(e) =>
                  setSettings({ ...settings, gstNumber: e.target.value.toUpperCase() })
                }
              />
            </div>
            <Button disabled={saving} onClick={() => save("organization")}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </Card>
        </TabsContent>
        <TabsContent value="rent" className="mt-4">
          <Card className="p-6 max-w-2xl space-y-4">
            <div>
              <Label className="mb-1.5 block">Rent due day of month</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={settings.dueDay}
                onChange={(e) => setSettings({ ...settings, dueDay: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Late fee (₹/day)</Label>
              <Input
                type="number"
                min={0}
                max={10000}
                value={settings.lateFeePerDay}
                onChange={(e) =>
                  setSettings({ ...settings, lateFeePerDay: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Notice period (days)</Label>
              <Input
                type="number"
                min={0}
                max={365}
                value={settings.noticePeriodDays}
                onChange={(e) =>
                  setSettings({ ...settings, noticePeriodDays: Number(e.target.value) })
                }
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Residents can view this policy. Rent reminders use the due day. Late fees require
              separate collection.
            </p>
            <Button disabled={saving} onClick={() => save("rent")}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
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
              ["rent", "Rent due reminders"],
              ["payments", "Payment received"],
              ["bookings", "New bookings"],
              ["complaints", "Complaint updates"],
              ["visitors", "Visitor check-ins"],
            ].map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <div className="font-medium">{label}</div>
                <Switch
                  aria-label={label}
                  checked={settings.notifications[key as keyof NotificationPreferences]}
                  onCheckedChange={(checked) =>
                    setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, [key]: checked },
                    })
                  }
                />
              </div>
            ))}
            <p className="text-sm text-muted-foreground">
              Choose which events appear in your notification feed and bell.
            </p>
            <Button disabled={saving} onClick={() => save("notifications")}>
              {saving ? "Saving…" : "Save preferences"}
            </Button>
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
