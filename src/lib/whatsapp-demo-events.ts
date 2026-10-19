import type { DemoWhatsappMessage } from "./demo-whatsapp";

export const whatsappEventActions = new Set([
  "verifyPayment",
  "undoDemoPayment",
  "updateBookingStatus",
  "createComplaint",
  "createMyComplaint",
  "updateComplaint",
  "sendDemoRentReminders",
]);

export function demoWhatsappMessages(entries: Record<string, string>): DemoWhatsappMessage[] {
  const raw = entries["pgone.demo.data.v1"];
  if (!raw) return [];
  return JSON.parse(raw)?.whatsapp?.messages ?? [];
}

// One real message per action. Prefer the tenant receipt over the duplicate owner alert.
export function demoWhatsappEvent(
  action: string,
  beforeIds: Set<string>,
  after: DemoWhatsappMessage[],
) {
  if (!whatsappEventActions.has(action)) return null;
  const fresh = after.filter((message) => !beforeIds.has(message.id));
  const byEvent = new Map<string, DemoWhatsappMessage>();
  for (const message of fresh) {
    const prior = byEvent.get(message.event);
    if (!prior || message.recipientRole === "tenant") byEvent.set(message.event, message);
  }
  // Staff task notices duplicate the complaint-new owner alert.
  const messages = [...byEvent.values()].filter((message) => !message.event.startsWith("task:"));
  if (!messages.length) return null;
  const lines = messages
    .slice(0, 8)
    .map(
      (message) =>
        `${message.recipientRole === "admin" ? "Owner" : message.recipientName}: ${message.body}`,
    );
  if (messages.length > 8)
    lines.push(`And ${messages.length - 8} more reminders. Review the demo inbox in PG One.`);
  return {
    ids: fresh.map((message) => message.id).sort(),
    body: `PG One — DEMO event\n${lines.join("\n\n")}\n\nForwarded to the demo phone only. No real booking or payment was made.`.slice(
      0,
      3500,
    ),
  };
}
