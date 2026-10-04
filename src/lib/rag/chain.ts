import { Chroma } from "@langchain/community/vectorstores/chroma";
import { CloudClient, ChromaClient } from "chromadb";
import { LocalEmbeddings } from "./local-embeddings";
import { generateAnswer } from "./local-llm";
import { COLLECTION_NAME } from "./ingest";

// Chroma Cloud (https://trychroma.com) — set CHROMA_API_KEY / CHROMA_TENANT /
// CHROMA_DATABASE to use it. If CHROMA_API_KEY is unset, falls back to a
// self-hosted Chroma server at CHROMA_URL (default localhost:8000).
//
// NOTE: @langchain/community's Chroma wrapper has a bug where passing
// `chromaCloudAPIKey`/`clientParams` doesn't actually change the connection
// target (it silently keeps using localhost). So we construct the
// chromadb client ourselves and hand it to LangChain via `index`, which it
// uses as-is.
const CHROMA_URL = process.env.CHROMA_URL ?? "http://localhost:8000";

function makeChromaClient(): ChromaClient {
  return process.env.CHROMA_API_KEY ? new CloudClient() : new ChromaClient({ path: CHROMA_URL });
}

// Below this similarity, we don't trust the retrieved context enough to
// answer — this is what "resolved without staff intervention" actually
// means: escalate rather than hallucinate. Threshold tuned on the labeled
// eval set in `eval.ts`; re-tune if you swap the embedding model.
const RELEVANCE_THRESHOLD = 0.45;
const TOP_K = 4;

// The chromadb/LangChain client doesn't expose an AbortSignal, so a bad
// CHROMA_TENANT/CHROMA_DATABASE value or an unreachable host can hang
// indefinitely instead of erroring. Race every Chroma call against a hard
// deadline so it fails fast with a diagnosable message instead of riding
// along until the platform's SSR watchdog (120s) kills the whole render.
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms.`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

const CHROMA_CONNECT_TIMEOUT_MS = 10_000;
const CHROMA_QUERY_TIMEOUT_MS = 10_000;

let vectorStorePromise: Promise<Chroma> | null = null;

function getVectorStore(): Promise<Chroma> {
  if (!vectorStorePromise) {
    const embeddings = new LocalEmbeddings();
    vectorStorePromise = withTimeout(
      Chroma.fromExistingCollection(embeddings, {
        collectionName: COLLECTION_NAME,
        index: makeChromaClient(),
      }),
      CHROMA_CONNECT_TIMEOUT_MS,
      "Chroma connection"
    ).catch((err) => {
      // Don't cache a failed connection attempt — let the next request retry
      // (e.g. after env vars are fixed) instead of permanently failing.
      vectorStorePromise = null;
      throw err;
    });
  }
  return vectorStorePromise;
}

export interface AssistantResponse {
  answer: string;
  resolved: boolean; // false => escalate to staff
  sources: string[];
  topScore: number;
}

export async function askAssistant(question: string): Promise<AssistantResponse> {
  const store = await getVectorStore();

  // similaritySearchWithScore returns cosine similarity via Chroma's default
  // "l2"/"cosine" space depending on collection config; we configure the
  // collection for cosine similarity at ingest time so higher = more similar.
  const results = await withTimeout(
    store.similaritySearchWithScore(question, TOP_K),
    CHROMA_QUERY_TIMEOUT_MS,
    "Chroma similarity search"
  );

  if (results.length === 0) {
    return {
      answer: "I don't have information on that yet. I've flagged this for staff to follow up.",
      resolved: false,
      sources: [],
      topScore: 0,
    };
  }

  const topScore = results[0][1];
  const sources = [...new Set(results.map(([doc]) => String(doc.metadata.source)))];

  if (topScore < RELEVANCE_THRESHOLD) {
    return {
      answer: "I'm not confident I have the right info for that. I've flagged this for staff to follow up.",
      resolved: false,
      sources,
      topScore,
    };
  }

  const contextChunks = results.map(([doc]) => doc.pageContent);
  const answer = await generateAnswer(question, contextChunks);

  return { answer, resolved: true, sources, topScore };
}
