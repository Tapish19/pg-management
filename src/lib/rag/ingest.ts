import fs from "fs";
import path from "path";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { LocalEmbeddings } from "./local-embeddings";

const DOCS_DIR = path.join(process.cwd(), "content", "hostel-docs");
export const COLLECTION_NAME = "hostel-policies-faqs";

// Chroma runs as a small local server (no cloud account, no API key):
//   pip install chromadb
//   chroma run --path ./chroma-data
// CHROMA_URL defaults to the standard local port.
const CHROMA_URL = process.env.CHROMA_URL ?? "http://localhost:8000";

async function loadDocs(): Promise<{ pageContent: string; metadata: Record<string, string> }[]> {
  const files = fs.readdirSync(DOCS_DIR).filter((f) => f.endsWith(".md"));
  return files.map((file) => ({
    pageContent: fs.readFileSync(path.join(DOCS_DIR, file), "utf-8"),
    metadata: { source: file },
  }));
}

export async function ingest(): Promise<void> {
  console.log(`Loading docs from ${DOCS_DIR} ...`);
  const rawDocs = await loadDocs();
  console.log(`Loaded ${rawDocs.length} document(s).`);

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 75,
    separators: ["\n## ", "\n### ", "\n\n", "\n", " "],
  });

  const chunks = await splitter.createDocuments(
    rawDocs.map((d) => d.pageContent),
    rawDocs.map((d) => d.metadata)
  );
  console.log(`Split into ${chunks.length} chunk(s). Embedding locally (first run downloads the model)...`);

  const embeddings = new LocalEmbeddings();

  await Chroma.fromDocuments(chunks, embeddings, {
    collectionName: COLLECTION_NAME,
    url: CHROMA_URL,
  });

  console.log(`Ingested ${chunks.length} chunks into Chroma collection "${COLLECTION_NAME}" at ${CHROMA_URL}.`);
}

// Allow running directly: `npx tsx src/lib/rag/ingest.ts`
if (require.main === module) {
  ingest()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Ingestion failed:", err);
      process.exit(1);
    });
}
