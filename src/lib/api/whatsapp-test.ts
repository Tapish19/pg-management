import { createHash, timingSafeEqual } from "node:crypto";

type Config = { token: string; phoneNumberId: string; recipient: string; passcode: string };
export function whatsappTestConfig(env: Record<string, string | undefined>): Config | null {
  const token = env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const recipient = env.WHATSAPP_TEST_RECIPIENT?.replace(/[\s()+-]/g, "");
  const passcode = env.WHATSAPP_DEMO_PASSCODE?.trim();
  if (
    env.WHATSAPP_DEMO_ENABLED !== "true" ||
    !token ||
    !/^\d+$/.test(phoneNumberId ?? "") ||
    !/^[1-9]\d{7,14}$/.test(recipient ?? "") ||
    !passcode ||
    passcode.length < 12 ||
    passcode.length > 200
  )
    return null;
  return { token, phoneNumberId: phoneNumberId!, recipient: recipient!, passcode };
}

export async function sendWhatsappTest(
  config: Config | null,
  passcode: string,
  reserve: () => Promise<void>,
  request: typeof fetch = fetch,
) {
  if (!config)
    throw new Error(
      "WhatsApp test sending is not configured. Follow the WhatsApp setup guide on the server.",
    );
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(digest(passcode.trim()), digest(config.passcode)))
    throw new Error(
      "Incorrect WhatsApp demo passcode. It does not match the value loaded by this deployment. If you changed it in Render, wait for deployment to finish and try again.",
    );
  // Reserve before sending, including failed/uncertain requests, to avoid accidental duplicates.
  await reserve();
  let response: Response;
  try {
    response = await request(`https://graph.facebook.com/v25.0/${config.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: config.recipient,
        type: "template",
        template: { name: "hello_world", language: { code: "en_US" } },
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error(
      "Meta could not be reached. Delivery is unknown; check WhatsApp before trying again after the cooldown.",
    );
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.messages?.[0]?.id) {
    // Never return Meta's raw payload: it may contain credentials or recipient details.
    const code = payload?.error?.code;
    if (code === 190)
      throw new Error("Your Meta access token has expired or is invalid. Update it in Render.");
    if (code === 131030)
      throw new Error("Verify the configured recipient in Meta's test-recipient list.");
    throw new Error(
      `Meta did not accept the test message (HTTP ${response.status}). Check the sender, token, recipient and hello_world template in Meta.`,
    );
  }
  return { accepted: true, recipient: `••••${config.recipient.slice(-4)}` };
}

export function checkWhatsappTestLimits(rows: { sentAt: number }[], now: number) {
  if (rows.some((row) => now - row.sentAt < 60_000))
    throw new Error("Wait 60 seconds between WhatsApp test attempts.");
  if (rows.length >= 10)
    throw new Error("Demo limit reached: 10 WhatsApp test attempts per 24 hours.");
}
