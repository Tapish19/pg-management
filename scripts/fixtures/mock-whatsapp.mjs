// Loaded explicitly with --import by isolated tests only. Never loaded by the app.
import fs from "node:fs";
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  if (!String(url).startsWith("https://graph.facebook.com/")) return originalFetch(url, options);
  const body = JSON.parse(String(options.body));
  if (process.env.WHATSAPP_CAPTURE_FILE)
    fs.appendFileSync(process.env.WHATSAPP_CAPTURE_FILE, JSON.stringify(body) + "\n");
  if (body.text?.body.includes("[simulate delivery failure]"))
    return Response.json({ error: { code: 131047 } }, { status: 400 });
  return Response.json({ messages: [{ id: "wamid.mock-only" }] });
};
