import assert from "node:assert/strict";
import {
  checkWhatsappTestLimits,
  sendWhatsappTest,
  whatsappTestConfig,
  sendWhatsappPayload,
} from "../src/lib/api/whatsapp-test";
import { demoWhatsappEvent, demoWhatsappMessages } from "../src/lib/whatsapp-demo-events";

const env = {
  WHATSAPP_DEMO_ENABLED: "true",
  WHATSAPP_PHONE_NUMBER_ID: "123456",
  WHATSAPP_ACCESS_TOKEN: "secret-test-token",
  WHATSAPP_TEST_RECIPIENT: "+91 98765 43210",
  WHATSAPP_DEMO_PASSCODE: "private-demo-passcode",
};
const config = whatsappTestConfig(env)!;
assert.equal(config.recipient, "919876543210");
assert.equal(
  whatsappTestConfig({ ...env, WHATSAPP_DEMO_PASSCODE: `  ${env.WHATSAPP_DEMO_PASSCODE}\n` })
    ?.passcode,
  config.passcode,
);
assert.equal(whatsappTestConfig({ ...env, WHATSAPP_DEMO_PASSCODE: "             " }), null);
assert.equal(whatsappTestConfig({ ...env, WHATSAPP_DEMO_ENABLED: "false" }), null);
assert.equal(whatsappTestConfig({ ...env, WHATSAPP_DEMO_PASSCODE: "short" }), null);
assert.equal(whatsappTestConfig({ ...env, WHATSAPP_TEST_RECIPIENT: "not-a-phone" }), null);
let reservations = 0,
  requests = 0;
const reserve = async () => {
  reservations++;
};
const request: typeof fetch = async (url, options) => {
  requests++;
  assert.equal(url, "https://graph.facebook.com/v25.0/123456/messages");
  assert.equal(reservations, 1, "Reserve a send attempt before contacting Meta");
  assert.equal(
    (options!.headers as Record<string, string>).Authorization,
    "Bearer secret-test-token",
  );
  assert.deepEqual(JSON.parse(String(options!.body)), {
    messaging_product: "whatsapp",
    to: "919876543210",
    type: "template",
    template: { name: "hello_world", language: { code: "en_US" } },
  });
  return Response.json({ messages: [{ id: "wamid.test" }] });
};
await assert.rejects(sendWhatsappTest(null, "anything", reserve, request), /not configured/);
await assert.rejects(sendWhatsappTest(config, "wrong", reserve, request), /Incorrect/);
assert.equal(reservations, 0);
assert.equal(requests, 0);
assert.deepEqual(await sendWhatsappTest(config, env.WHATSAPP_DEMO_PASSCODE, reserve, request), {
  accepted: true,
  recipient: "••••3210",
});
assert.equal(requests, 1);
await assert.rejects(
  sendWhatsappTest(
    config,
    env.WHATSAPP_DEMO_PASSCODE,
    async () => {
      throw new Error("cooldown");
    },
    request,
  ),
  /cooldown/,
);
assert.equal(requests, 1, "Blocked attempts must not call Meta");
await assert.rejects(
  sendWhatsappTest(config, env.WHATSAPP_DEMO_PASSCODE, reserve, async () =>
    Response.json({ error: { code: 190, message: env.WHATSAPP_ACCESS_TOKEN } }, { status: 401 }),
  ),
  /expired or is invalid/,
);
await assert.rejects(
  sendWhatsappTest(config, env.WHATSAPP_DEMO_PASSCODE, reserve, async () =>
    Response.json({ error: { code: 131030 } }, { status: 400 }),
  ),
  /test-recipient/,
);
await assert.rejects(
  sendWhatsappTest(config, env.WHATSAPP_DEMO_PASSCODE, reserve, async () => {
    throw new Error(env.WHATSAPP_ACCESS_TOKEN);
  }),
  /Delivery is unknown/,
);
await assert.rejects(
  sendWhatsappTest(config, env.WHATSAPP_DEMO_PASSCODE, reserve, async () =>
    Response.json({ error: { message: env.WHATSAPP_ACCESS_TOKEN } }, { status: 500 }),
  ),
  (error: Error) =>
    !error.message.includes(env.WHATSAPP_ACCESS_TOKEN) && error.message.includes("HTTP 500"),
);
const now = 1_000_000;
let paddedSends = 0;
await sendWhatsappTest(
  config,
  `  ${env.WHATSAPP_DEMO_PASSCODE}\n`,
  async () => {},
  async () => {
    paddedSends++;
    return Response.json({ messages: [{ id: "wamid.padded-test" }] });
  },
);
assert.equal(paddedSends, 1, "Ignore pasted whitespace around a valid passcode");
await assert.rejects(
  sendWhatsappTest(
    config,
    "private demo-passcode",
    async () => {},
    async () => {
      throw new Error("Must never reach Meta for a different passcode");
    },
  ),
  /Incorrect/,
);
assert.throws(() => checkWhatsappTestLimits([{ sentAt: now - 59_999 }], now), /60 seconds/);
assert.throws(
  () =>
    checkWhatsappTestLimits(
      Array.from({ length: 10 }, () => ({ sentAt: now - 61_000 })),
      now,
    ),
  /10 WhatsApp/,
);
assert.doesNotThrow(() => checkWhatsappTestLimits([{ sentAt: now - 60_000 }], now));
console.log(
  "WhatsApp tests passed: configuration, authorization, fixed recipient/template, delivery errors, redaction and send limits. No real messages sent.",
);

const message = (id: string, event: string, recipientRole: "admin" | "tenant" = "tenant") => ({
  id,
  event,
  recipientRole,
  recipientId: "tenant-1",
  recipientName: "Demo Resident",
  phone: "fictional-phone",
  body: `Event ${event}`,
  createdAt: new Date().toISOString(),
  read: false,
});
assert.deepEqual(demoWhatsappMessages({}), []);
for (const [action, event] of [
  ["verifyPayment", "payment:p1"],
  ["updateBookingStatus", "booking:b1:confirmed"],
  ["updateComplaint", "complaint:c1:resolved"],
  ["sendDemoRentReminders", "rent:b1:2026-10"],
  ["createMyVisitor", "visitor-request:v1"],
  ["reviewVisitorRequest", "visitor-review:v1:approved"],
  ["checkInVisitor", "visitor-in:v1"],
  ["checkOutVisitor", "visitor-out:v1"],
]) {
  const result = demoWhatsappEvent(action, new Set(), [message("new", event)])!;
  assert.ok(result.body.includes(event));
  assert.ok(result.body.includes("DEMO"));
  assert.equal(
    demoWhatsappEvent(action, new Set(["new"]), [message("new", event)]),
    null,
    "Never replay existing events",
  );
}
assert.equal(demoWhatsappEvent("snapshot", new Set(), [message("new", "payment:p1")]), null);
const combined = demoWhatsappEvent("verifyPayment", new Set(), [
  message("1", "payment:p1", "admin"),
  message("2", "payment:p1"),
])!;
assert.equal(
  (combined.body.match(/Event payment:p1/g) ?? []).length,
  1,
  "One real receipt per payment event",
);
const reminders = demoWhatsappEvent(
  "sendDemoRentReminders",
  new Set(),
  Array.from({ length: 20 }, (_, index) => message(String(index), `rent:b${index}:month`)),
)!;
assert.ok(
  reminders.body.includes("12 more reminders"),
  "Batch reminder notifications into one bounded digest",
);
await sendWhatsappPayload(
  config,
  { type: "text", text: { body: "PG One DEMO receipt" } },
  async (_url, options) => {
    const body = JSON.parse(String(options?.body));
    assert.equal(body.to, config.recipient);
    assert.equal(body.type, "text");
    assert.equal(body.text.body, "PG One DEMO receipt");
    return Response.json({ messages: [{ id: "wamid.text" }] });
  },
);
await assert.rejects(
  sendWhatsappPayload(config, { type: "text" }, async () =>
    Response.json({ error: { code: 131047 } }, { status: 400 }),
  ),
  /Reply.*24-hour/,
);
console.log(
  "WhatsApp event tests passed: event routing, duplicate suppression, bounded reminder digest and customer-service-window errors.",
);
