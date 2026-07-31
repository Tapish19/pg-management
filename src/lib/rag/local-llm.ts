// Answer generation via the Groq API (hosted, OpenAI-compatible), rather
// than running a local transformer model in-process.
//
// Why hosted at all: running a local generation model (previously
// Xenova/LaMini-Flan-T5, 248M params) via CPU inference inside a web
// request handler was too slow on Render's instance size — first-load
// model download + inference time exceeded the platform's SSR request
// timeout (120s), causing the whole service to hang and cycle-restart.
// A hosted API call is fast, doesn't need to load any model, and won't
// block the event loop. Groq also has a free tier (no card required),
// which is more than enough for a small app like this.
//
// Requires GROQ_API_KEY to be set (Render -> Environment). Get one at
// https://console.groq.com/keys. Uses llama-3.1-8b-instant: Groq's
// cheapest/fastest model, a good fit for short retrieval-grounded FAQ
// answers.
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MODEL = "llama-3.1-8b-instant";

export async function generateAnswer(question: string, contextChunks: string[]): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not set. Add it in your environment variables.");
  }

  const context = contextChunks.map((c, i) => `[${i + 1}] ${c}`).join("\n\n");

  const systemPrompt = [
    "You are a helpful hostel assistant. Answer the tenant's question using ONLY the context below.",
    "If the answer isn't in the context, say you don't have that information and suggest contacting staff.",
    "Be concise (2-4 sentences).",
    "",
    `Context:\n${context}`,
  ].join("\n");

  // Groq's API follows the OpenAI Chat Completions schema.
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
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
    throw new Error(`Groq API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const answer = data.choices?.[0]?.message?.content;
  if (!answer) throw new Error("No content in Groq API response.");

  return (answer as string).trim();
}
