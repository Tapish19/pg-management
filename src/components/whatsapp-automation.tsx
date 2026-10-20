import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { shareDemo, sharedDemoId } from "@/lib/demo-sharing";
import {
  getWhatsappForwardingStatus,
  getWhatsappTestStatus,
  setWhatsappForwarding,
} from "@/lib/api/functions/whatsapp-fns";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

const titles: Record<string, string> = {
  verifyPayment: "Payment receipt",
  undoDemoPayment: "Payment reversal",
  updateBookingStatus: "Booking update",
  createComplaint: "New complaint",
  createMyComplaint: "New complaint",
  updateComplaint: "Complaint update",
  sendDemoRentReminders: "Rent reminders",
  createMyVisitor: "Visitor request",
  reviewVisitorRequest: "Visitor approval",
  checkInVisitor: "Visitor check-in",
  checkOutVisitor: "Visitor check-out",
};
const states: Record<string, string> = {
  accepted: "Accepted by Meta",
  failed: "Failed or unconfirmed",
  skipped: "Not sent",
  pending: "Queued",
  sending: "Sending / outcome unconfirmed",
};

export function WhatsappAutomation() {
  const { user, isDemo } = useAuth();
  const queryClient = useQueryClient();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [passcode, setPasscode] = useState("");
  const [replied, setReplied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  useEffect(() => {
    const sync = () => setWorkspaceId(sharedDemoId());
    sync();
    window.addEventListener("demo-synced", sync);
    return () => window.removeEventListener("demo-synced", sync);
  }, []);
  const configured = useQuery({
    queryKey: ["whatsapp-test-status"],
    queryFn: () => getWhatsappTestStatus(),
    enabled: isDemo && user?.role === "admin",
    retry: false,
  });
  const status = useQuery({
    queryKey: ["whatsapp-forwarding", workspaceId],
    queryFn: () => getWhatsappForwardingStatus({ data: { workspaceId: workspaceId! } }),
    enabled: isDemo && user?.role === "admin" && !!workspaceId,
    refetchInterval: 10_000,
    retry: false,
  });
  if (!isDemo || user?.role !== "admin") return null;
  async function change(enabled: boolean) {
    setBusy(true);
    setFeedback("");
    try {
      let id = sharedDemoId();
      if (!id && enabled) {
        await shareDemo();
        id = sharedDemoId();
      }
      if (!id) throw new Error("Create a demo workspace first.");
      const result = await setWhatsappForwarding({
        data: { workspaceId: id, passcode, enabled, repliedToSender: replied },
      });
      setWorkspaceId(id);
      setPasscode("");
      await queryClient.invalidateQueries({ queryKey: ["whatsapp-forwarding"] });
      setFeedback(
        result.active
          ? "Connected for one hour. Switch roles and perform a new demo action to send an update to your configured test phone."
          : "Automatic WhatsApp messages disabled.",
      );
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not update automatic messages.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="p-6 max-w-2xl space-y-4 my-4">
      <h2 className="font-semibold">Automatic WhatsApp demo messages</h2>
      <p className="text-sm text-muted-foreground">
        Connect payment receipts, booking changes, visitor requests and approvals, new complaints,
        complaint updates and generated rent reminders. Every message goes to your one configured
        test phone, labelled DEMO.
      </p>
      <ol className="list-decimal pl-5 text-sm space-y-1">
        <li>Send Hello World using the test above.</li>
        <li>
          Reply “Hi” to that sender in WhatsApp. This opens Meta's 24-hour window for custom
          messages.
        </li>
        <li>
          Enter your demo passcode and enable forwarding for this workspace. Keep “Enable demo
          WhatsApp messages” switched on below.
        </li>
      </ol>
      {configured.isError ? (
        <p role="alert">
          Could not check WhatsApp configuration.{" "}
          <Button variant="outline" onClick={() => configured.refetch()}>
            Retry
          </Button>
        </p>
      ) : !configured.data?.configured ? (
        <p className="text-sm">Configure the test connection above first.</p>
      ) : (
        <>
          <p className="text-sm font-medium">
            {status.data?.active
              ? `On until ${new Date(status.data.expiresAt!).toLocaleTimeString()}`
              : "Automatic messages are off"}
          </p>
          {status.isError && (
            <p role="alert">
              Could not load forwarding status.{" "}
              <Button variant="outline" onClick={() => status.refetch()}>
                Retry
              </Button>
            </p>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void change(true);
            }}
            className="space-y-3"
          >
            <Label htmlFor="whatsapp-auto-passcode">Automation passcode</Label>
            <Input
              id="whatsapp-auto-passcode"
              type="password"
              autoComplete="off"
              value={passcode}
              maxLength={200}
              onChange={(event) => setPasscode(event.target.value)}
              required
              placeholder="Same private demo passcode"
            />
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={replied}
                onChange={(event) => setReplied(event.target.checked)}
                className="mt-1"
              />
              I replied to the test sender and want new demo events forwarded to my test phone.
            </label>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy || !passcode || !replied}>
                {busy
                  ? "Saving…"
                  : status.data?.active
                    ? "Renew for one hour"
                    : "Enable automatic messages"}
              </Button>
              {status.data?.active && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || !passcode}
                  onClick={() => void change(false)}
                >
                  Disable automatic messages
                </Button>
              )}
            </div>
          </form>
          <p className="text-xs text-muted-foreground">
            Enabling saves this demo as a shared workspace so role changes use the same events.
            Anyone using its private share link can trigger these messages while enabled. No old
            notifications are replayed. Up to 5 attempts per minute and 30 per day. Rent reminders
            run when you click Generate rent reminders; they are not scheduled.
          </p>
        </>
      )}
      {feedback && (
        <p role="status" className="text-sm">
          {feedback}
        </p>
      )}
      {!!status.data?.history.length && (
        <div className="space-y-2" aria-label="Real WhatsApp delivery attempts">
          <h3 className="font-medium text-sm">Recent requests</h3>
          {status.data.history.map((item, index) => (
            <div key={`${item.createdAt}-${index}`} className="rounded border p-3 text-sm">
              <p>
                {titles[item.action] ?? "Demo update"} · {states[item.status] ?? item.status}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(item.createdAt).toLocaleString()}
              </p>
              {item.error && <p className="text-xs mt-1">{item.error}</p>}
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Accepted means Meta accepted the request. Check your phone to confirm delivery. Failed
            or uncertain requests are not automatically retried.
          </p>
        </div>
      )}
    </Card>
  );
}
