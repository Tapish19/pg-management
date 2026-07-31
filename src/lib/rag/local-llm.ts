// Answer generation via the xAI Grok API (hosted), rather than running a
// local transformer model in-process.
//
// Why hosted at all: running a local generation model (previously
// Xenova/LaMini-Flan-T5, 248M params) via CPU inference inside a web
// request handler was too slow on Render's instance size — first-load
// model download + inference time exceeded the platform's SSR request
// timeout (120s), causing the whole service to hang and cycle-restart.
// A hosted API call is fast, doesn't need to load any model, and won't
// block the event loop.
//
// Requires XAI_API_KEY to be set (Render -> Environment). Get one at
// https://console.x.ai. Uses grok-4-1-fast: cheap, fast, good fit for
// short retrieval-grounded FAQ answers.
const XAI_API_KEY = process.env.XAI_API_KEY;
const MODEL = "grok-4-1-fast";

export async function generateAnswer(question: string, contextChunks: string[]): Promise<string> {
  if (!XAI_API_KEY) {
    throw new Error("XAI_API_KEY is not set. Add it in your environment variables.");
  }

  const context = contextChunks.map((c, i) => `[${i + 1}] ${c}`).join("\n\n");

  const systemPrompt = [
    "You are a helpful hostel assistant. Answer the tenant's question using ONLY the context below.",
    "If the answer isn't in the context, say you don't have that information and suggest contacting staff.",
    "Be concise (2-4 sentences).",
    "",
    `Context:\n${context}`,
  ].join("\n");

  // xAI's API is OpenAI-compatible (Chat Completions schema).
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`xAI API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const answer = data.choices?.[0]?.message?.content;
  if (!answer) throw new Error("No content in xAI API response.");

  return (answer as string).trim();
}
