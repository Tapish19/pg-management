import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, CheckCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { runDemoAction } from "@/lib/demo-sharing";
import type { DemoWhatsappInbox } from "@/lib/demo-whatsapp";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Switch } from "./ui/switch";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { toast } from "sonner";

function useDemoWhatsapp() {
  const { user, isDemo } = useAuth();
  return useQuery({
    queryKey: ["demo-whatsapp", user?.id],
    enabled: isDemo,
    queryFn: async () => (await runDemoAction("getDemoWhatsapp")) as DemoWhatsappInbox,
    refetchInterval: 15_000,
  });
}
export function DemoWhatsappButton() {
  const { user, isDemo } = useAuth();
  const query = useDemoWhatsapp();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  if (!isDemo) return null;
  const unread = query.data?.messages.filter((m) => !m.read).length ?? 0;
  async function read() {
    setBusy(true);
    try {
      await runDemoAction("readDemoWhatsapp");
      await client.invalidateQueries({ queryKey: ["demo-whatsapp"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not mark messages read");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={`WhatsApp demo${unread ? `, ${unread} unread` : ""}`}
          className="gap-1 text-emerald-700"
        >
          <MessageCircle className="h-4 w-4" />
          <span className="hidden sm:inline">WhatsApp</span>
          {unread > 0 && <Badge variant="secondary">{unread}</Badge>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>WhatsApp demo inbox</DialogTitle>
        </DialogHeader>
        <div className="rounded-lg bg-emerald-50 p-3 text-emerald-950">
          <p className="font-medium">PG One Business · {user?.name}</p>
          <p className="text-xs">
            Simulated messages only. Nothing is sent to WhatsApp or a real phone.
          </p>
        </div>
        {query.isLoading ? (
          <p>Loading messages…</p>
        ) : query.isError ? (
          <div role="alert">
            Could not load messages.{" "}
            <Button variant="outline" onClick={() => query.refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <>
            {!query.data?.enabled && (
              <p className="text-sm text-muted-foreground">
                New WhatsApp messages are paused by the owner.
              </p>
            )}
            <Button size="sm" variant="outline" disabled={!unread || busy} onClick={read}>
              <CheckCheck className="h-4 w-4 mr-1" />
              Mark messages read
            </Button>
            {!query.data?.messages.length && (
              <p className="text-sm text-muted-foreground">
                No messages yet. Demo payments, booking updates and complaints generate messages.
                Owners can generate rent reminders or a preview from Settings → Notifications.
              </p>
            )}
            <div className="space-y-3" aria-label="WhatsApp messages">
              {query.data?.messages.map((message) => (
                <article
                  key={message.id}
                  className={`rounded-lg border p-3 ${message.read ? "bg-muted/30" : "bg-emerald-50 border-emerald-200"}`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
                  <div className="mt-2 flex justify-between gap-2 text-xs text-muted-foreground">
                    <span>{new Date(message.createdAt).toLocaleString()}</span>
                    <span>{message.read ? "Read · " : ""}Simulated</span>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
export function DemoWhatsappSettings() {
  const query = useDemoWhatsapp();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function action(name: string, input: unknown = {}) {
    setBusy(true);
    try {
      const result = (await runDemoAction(name, input)) as { count?: number };
      await client.invalidateQueries({ queryKey: ["demo-whatsapp"] });
      toast.success(
        name === "sendDemoRentReminders"
          ? `${result.count ?? 0} new demo rent reminders generated`
          : name === "previewDemoWhatsapp"
            ? "Preview added to your WhatsApp demo inbox"
            : "WhatsApp demo preference saved",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update WhatsApp demo");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="p-6 max-w-2xl space-y-3 mt-4">
      <h2 className="font-semibold">WhatsApp demo notifications</h2>
      <p className="text-sm text-muted-foreground">
        Preview business notifications without an account, phone connection or message fees. Open
        WhatsApp in the top bar to read each role's messages.
      </p>
      {query.isError ? (
        <p role="alert">
          Could not load WhatsApp preferences.{" "}
          <Button variant="outline" onClick={() => query.refetch()}>
            Retry
          </Button>
        </p>
      ) : (
        <>
          <label className="flex items-center justify-between gap-3">
            <span>Enable demo WhatsApp messages</span>
            <Switch
              aria-label="Enable demo WhatsApp messages"
              disabled={busy || query.isLoading}
              checked={query.data?.enabled ?? false}
              onCheckedChange={(enabled) => action("setDemoWhatsapp", { enabled })}
            />
          </label>
          <p className="text-sm text-muted-foreground">
            Payments notify the owner and tenant. Booking and complaint updates notify the tenant;
            new complaints notify the owner and staff. Rent reminders are generated for unpaid
            current-month bookings, once per booking.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={busy || !query.data?.enabled}
              onClick={() => action("previewDemoWhatsapp")}
            >
              Send demo preview
            </Button>
            <Button
              disabled={busy || !query.data?.enabled}
              onClick={() => action("sendDemoRentReminders")}
            >
              Generate rent reminders
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
