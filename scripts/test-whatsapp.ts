import assert from "node:assert/strict";
import {
  checkWhatsappTestLimits,
  sendWhatsappTest,
  whatsappTestConfig,
} from "../src/lib/api/whatsapp-test";

const env = {
  WHATSAPP_DEMO_ENABLED: "true",
  WHATSAPP_PHONE_NUMBER_ID: "123456",
  WHATSAPP_ACCESS_TOKEN: "secret-test-token",
  WHATSAPP_TEST_RECIPIENT: "+91 98765 43210",
  WHATSAPP_DEMO_PASSCODE: "private-demo-passcode",
};
const config = whatsappTestConfig(env)!;
assert.equal(config.recipient, "919876543210");
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
