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
const COHERE_API_KEY = process.env.COHERE_API_KEY;
const MODEL_NAME = "embed-english-v3.0";

async function cohereEmbed(texts: string[], inputType: "search_document" | "search_query"): Promise<number[][]> {
  if (!COHERE_API_KEY) {
    throw new Error("COHERE_API_KEY is not set. Add it in your environment variables.");
  }

  const response = await fetch("https://api.cohere.com/v2/embed", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${COHERE_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      texts,
      input_type: inputType,
      embedding_types: ["float"],
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Cohere embed API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const vectors = data.embeddings?.float;
  if (!vectors) throw new Error("No embeddings in Cohere API response.");

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
