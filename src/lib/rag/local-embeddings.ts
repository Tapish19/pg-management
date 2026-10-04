import { Embeddings, type EmbeddingsParams } from "@langchain/core/embeddings";

// Hosted embeddings via Cohere's Embed API, rather than running a local
// transformer model in-process.
//
// Why: the previous local model (Xenova/all-MiniLM-L6-v2, transformers.js)
// had to be downloaded and loaded on every cold start, since Render's disk
// is ephemeral and doesn't persist the model cache between restarts. That
// download/load, combined with slow CPU inference, contributed to the same
// SSR request timeout (120s) that the local generation model caused —
// fixed the same way: move the ML workload to a hosted API instead of
// running it in the request handler.
//
// Requires COHERE_API_KEY to be set (Render -> Environment). Get a free
// trial key (no card required) at https://dashboard.cohere.com/api-keys.
//
// IMPORTANT: embedding dimensions/model must match between ingestion and
// querying, since they share one vector space. If you're switching from
// the old local model, you MUST re-run `npm run rag:ingest` after this
// change — old vectors were 384-dim (MiniLM), these are 1024-dim
// (Cohere embed-english-v3.0) and are not compatible.

const MODEL_NAME = "embed-english-v3.0";

// Hard cap so a stalled Cohere request can't ride along until the platform's
// SSR watchdog (120s) kills the whole render. Fails fast with a diagnosable
// message instead.
const TIMEOUT_MS = 10_000;

async function cohereEmbed(
  texts: string[],
  inputType: "search_document" | "search_query"
): Promise<number[][]> {
  // Read lazily (not as a module-level const) — this file gets imported
  // before ingest.ts's env-file loading runs (ES module imports execute
  // before the rest of the importing file's top-level code), so caching
  // this at import time would always see `undefined`.
  const apiKey = process.env.COHERE_API_KEY;

  if (!apiKey) {
    throw new Error(
      "COHERE_API_KEY is not set. Add it in your environment variables."
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch("https://api.cohere.com/v2/embed", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        texts,
        input_type: inputType,
        embedding_types: ["float"],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Cohere embed API timed out after ${TIMEOUT_MS}ms.`);
    }
    throw new Error(`Cohere embed API request failed: ${(err as Error).message}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Cohere embed API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const vectors = data.embeddings?.float;

  if (!vectors) {
    throw new Error("No embeddings in Cohere API response.");
  }

  return vectors as number[][];
}

export class LocalEmbeddings extends Embeddings {
  constructor(params: EmbeddingsParams = {}) {
    super(params);
  }

  async embedQuery(text: string): Promise<number[]> {
    const [vector] = await cohereEmbed([text], "search_query");
    return vector;
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return cohereEmbed(texts, "search_document");
  }
}
