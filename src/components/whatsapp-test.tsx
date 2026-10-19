import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getWhatsappTestStatus, sendWhatsappTestMessage } from "@/lib/api/functions/whatsapp-fns";
import { useAuth } from "@/lib/auth";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export function WhatsappTest() {
  const { user } = useAuth();
  const status = useQuery({
    queryKey: ["whatsapp-test-status"],
    queryFn: () => getWhatsappTestStatus(),
    enabled: user?.role === "admin",
    retry: false,
  });
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [failed, setFailed] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  useEffect(() => {
    if (!cooldownUntil) return;
    const timer = setTimeout(() => setCooldownUntil(0), Math.max(0, cooldownUntil - Date.now()));
    return () => clearTimeout(timer);
  }, [cooldownUntil]);
  if (user?.role !== "admin") return null;
  async function send(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFeedback("");
    try {
      const result = await sendWhatsappTestMessage({ data: { passcode } });
      setFailed(false);
      setFeedback(
        `Meta accepted the Hello World message for ${result.recipient}. Check WhatsApp on your phone; acceptance does not confirm delivery.`,
      );
      setPasscode("");
      setCooldownUntil(Date.now() + 60_000);
    } catch (error) {
      setFailed(true);
      setFeedback(error instanceof Error ? error.message : "Could not send the test message.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="p-6 max-w-2xl space-y-3 my-4">
      <h2 className="font-semibold">Send a real WhatsApp test</h2>
      <p className="text-sm text-muted-foreground">
        Send Meta's Hello World template from your test sender to the verified phone configured for
        this demo. This message arrives on WhatsApp, separately from the simulated inbox.
      </p>
      {status.isError ? (
        <p role="alert">
          Could not check the connection.{" "}
          <Button variant="outline" onClick={() => status.refetch()}>
            Retry
          </Button>
        </p>
      ) : status.isPending ? (
        <p className="text-sm">Checking connection…</p>
      ) : !status.data?.configured ? (
        <p className="text-sm">
          Not connected yet. Configure the WhatsApp test sender and demo passcode on the server,
          then refresh this page.
        </p>
      ) : (
        <form onSubmit={send} className="space-y-3">
          <Label htmlFor="whatsapp-demo-passcode">Private demo passcode</Label>
          <Input
            id="whatsapp-demo-passcode"
            type="password"
            autoComplete="off"
            maxLength={200}
            value={passcode}
            onChange={(event) => setPasscode(event.target.value)}
            placeholder="Enter your demo passcode"
            required
          />
          <Button type="submit" disabled={busy || !passcode || cooldownUntil > Date.now()}>
            {busy
              ? "Sending…"
              : cooldownUntil > Date.now()
                ? "Wait 60 seconds to send again"
                : "Send test WhatsApp"}
          </Button>
          <p className="text-xs text-muted-foreground">
            One attempt per minute, up to 10 per day. The recipient is fixed for this demo.
          </p>
        </form>
      )}
      {feedback && (
        <p role={failed ? "alert" : "status"} className="text-sm">
          {feedback}
        </p>
      )}
    </Card>
  );
}
