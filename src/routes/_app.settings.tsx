import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { getOwnerSettings, updateOwnerSettings } from "@/lib/api/functions/settings-fns";
import { toast } from "sonner";
import { SampleDataCard } from "@/components/sample-data-card";
import { DemoSharingCard, DemoRoleEditor } from "@/components/demo-workspace-settings";
import { runDemoAction } from "@/lib/demo-sharing";
import { readDemoPaymentMethods, type DemoPaymentMethod } from "@/lib/demo-payment-settings";
import { z } from "zod";
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
  const [validationError, setValidationError] = useState("");
  const queryClient = useQueryClient();
  async function save(section: "organization" | "rent" | "notifications") {
    setValidationError("");
    setSaving(true);
    try {
      if (section === "organization") organizationSchema.parse(settings);
      else if (section === "rent") rentRulesSchema.parse(settings);
      else notificationPreferencesSchema.parse(settings.notifications);
      if (demoOwnerId) {
        await runDemoAction("getDemoConfig");
        const current = readDemoSettings(demoOwnerId);
        const update =
          section === "organization"
            ? organizationSchema.parse(settings)
            : section === "rent"
              ? rentRulesSchema.parse(settings)
              : { notifications: notificationPreferencesSchema.parse(settings.notifications) };
        await runDemoAction("saveDemoConfig", {
          key: demoSettingsKey(demoOwnerId),
          value: { ...current, ...update },
        });
        await queryClient.invalidateQueries({ queryKey: ["owner-settings", "demo", demoOwnerId] });
        await queryClient.invalidateQueries({ queryKey: ["owner-notifications"] });
        await queryClient.invalidateQueries({ queryKey: ["my-booking"] });
        toast.success("Demo settings saved");
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
      const labels: Record<string, string> = {
        organizationName: "Organization name",
        contactEmail: "Contact email",
        gstNumber: "GST number",
        dueDay: "Rent due day",
        lateFeePerDay: "Late fee",
        noticePeriodDays: "Notice period",
      };
      const message =
        error instanceof z.ZodError
          ? error.issues
              .map((issue) => `${labels[String(issue.path[0])] ?? "Setting"}: ${issue.message}`)
              .join(". ")
          : error instanceof Error
            ? error.message
            : "Could not save settings";
      setValidationError(message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <PageHeader title="Settings" description="Organization, payments, notifications & roles." />
      {demoOwnerId && <DemoSharingCard />}
      {demoOwnerId ? (
        <p className="mb-4 text-sm text-muted-foreground">
          Demo mode: organization, rent rules and notification preferences save on this browser.
        </p>
      ) : (
        <SampleDataCard />
      )}
      <Tabs defaultValue="org" onValueChange={() => setValidationError("")}>
        {validationError && (
          <p
            role="alert"
            className="mb-4 rounded-md border border-destructive/30 p-3 text-sm text-destructive"
          >
            {validationError}
          </p>
        )}
        <div className="max-w-full overflow-x-auto">
          <TabsList className="w-max">
            <TabsTrigger value="org">Organization</TabsTrigger>
            <TabsTrigger value="rent">Rent rules</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="notify">Notifications</TabsTrigger>
            <TabsTrigger value="roles">Roles</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="org" className="mt-4">
          <Card className="p-6 max-w-2xl space-y-4">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void save("organization");
              }}
            >
              <div>
                <Label htmlFor="settings-org-name" className="mb-1.5 block">
                  Organization name
                </Label>
                <Input
                  id="settings-org-name"
                  value={settings.organizationName}
                  onChange={(e) => setSettings({ ...settings, organizationName: e.target.value })}
                  maxLength={120}
                />
              </div>
              <div>
                <Label htmlFor="settings-email" className="mb-1.5 block">
                  Contact email
                </Label>
                <Input
                  id="settings-email"
                  type="email"
                  value={settings.contactEmail}
                  onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="settings-gst" className="mb-1.5 block">
                  GST number (optional)
                </Label>
                <Input
                  id="settings-gst"
                  placeholder="29ABCDE1234F1Z5"
                  maxLength={15}
                  value={settings.gstNumber}
                  onChange={(e) =>
                    setSettings({ ...settings, gstNumber: e.target.value.toUpperCase() })
                  }
                />
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </form>
          </Card>
        </TabsContent>
        <TabsContent value="rent" className="mt-4">
          <Card className="p-6 max-w-2xl space-y-4">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void save("rent");
              }}
            >
              <div>
                <Label htmlFor="settings-due-day" className="mb-1.5 block">
                  Rent due day of month
                </Label>
                <Input
                  id="settings-due-day"
                  type="number"
                  min={1}
                  max={31}
                  value={Number.isFinite(settings.dueDay) ? settings.dueDay : ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      dueDay: e.target.value === "" ? NaN : Number(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="settings-late-fee" className="mb-1.5 block">
                  Late fee (₹/day)
                </Label>
                <Input
                  id="settings-late-fee"
                  type="number"
                  step="0.01"
                  min={0}
                  max={10000}
                  value={Number.isFinite(settings.lateFeePerDay) ? settings.lateFeePerDay : ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      lateFeePerDay: e.target.value === "" ? NaN : Number(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="settings-notice-days" className="mb-1.5 block">
                  Notice period (days)
                </Label>
                <Input
                  id="settings-notice-days"
                  type="number"
                  min={0}
                  max={365}
                  value={
                    Number.isFinite(settings.noticePeriodDays) ? settings.noticePeriodDays : ""
                  }
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      noticePeriodDays: e.target.value === "" ? NaN : Number(e.target.value),
                    })
                  }
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Residents can view this policy. Rent reminders use the due day. Late fees require
                separate collection.
              </p>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </form>
          </Card>
        </TabsContent>
        <TabsContent value="payments" className="mt-4">
          {demoOwnerId ? (
            <DemoPaymentSettings />
          ) : (
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
          )}
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
            ]
              .filter(([r]) => !demoOwnerId || r !== "Manager")
              .map(([r, d]) => (
                <div key={r} className="flex items-center justify-between border rounded-lg p-3">
                  <div>
                    <div className="font-medium">{r}</div>
                    <div className="text-xs text-muted-foreground">{d}</div>
                  </div>
                  {demoOwnerId ? (
                    <DemoRoleEditor
                      role={r === "Owner / Admin" ? "admin" : r === "Tenant" ? "tenant" : "staff"}
                    />
                  ) : (
                    <Button size="sm" variant="outline">
                      Edit
                    </Button>
                  )}
                </div>
              ))}
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function DemoPaymentSettings() {
  const [methods, setMethods] = useState(readDemoPaymentMethods);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const refresh = () => setMethods(readDemoPaymentMethods());
    window.addEventListener("demo-synced", refresh);
    return () => window.removeEventListener("demo-synced", refresh);
  }, []);
  async function change(key: DemoPaymentMethod, value: boolean) {
    setSaving(true);
    const next = { ...methods, [key]: value };
    try {
      await runDemoAction("saveDemoConfig", { key: "pgone.demo.payment-methods.v1", value: next });
      setMethods(next);
      toast.success("Demo payment preference saved");
    } catch {
      toast.error("Could not save demo payment preferences");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Card className="p-6 max-w-2xl space-y-4">
      <p className="text-sm text-muted-foreground">
        Demo payment connections are simulated. No credentials or real payment account are needed.
      </p>
      {(["cash", "upi", "razorpay", "stripe"] as const).map((key) => (
        <div key={key} className="flex items-center justify-between">
          <span className="capitalize font-medium">{key === "upi" ? "UPI" : key}</span>
          {key === "cash" || key === "upi" ? (
            <Switch
              aria-label={key}
              disabled={saving}
              checked={methods[key]}
              onCheckedChange={(value) => change(key, value)}
            />
          ) : (
            <Button
              aria-label={`${methods[key] ? "Disconnect" : "Connect"} ${key} demo`}
              size="sm"
              disabled={saving}
              variant="outline"
              onClick={() => change(key, !methods[key])}
            >
              {methods[key] ? "Disconnect demo" : "Connect demo"}
            </Button>
          )}
        </div>
      ))}
    </Card>
  );
}
