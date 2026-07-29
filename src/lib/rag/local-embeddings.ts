import { Embeddings, type EmbeddingsParams } from "@langchain/core/embeddings";
import { pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";

// Local, free, no-API-key embedding model (runs entirely on-device via
// transformers.js / ONNX runtime). Model weights are downloaded once from
// the Hugging Face hub on first use and cached locally under
// node_modules/@xenova/transformers/.cache — after that it works offline.
//
// all-MiniLM-L6-v2 produces 384-dim embeddings and is the standard
// lightweight choice for local RAG (used by sentence-transformers, LangChain
// docs, etc.) — good tradeoff between quality and speed on CPU.
const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", MODEL_NAME) as Promise<FeatureExtractionPipeline>;
  }
  return extractorPromise;
}

export class LocalEmbeddings extends Embeddings {
  constructor(params: EmbeddingsParams = {}) {
    super(params);
  }

  async embedQuery(text: string): Promise<number[]> {
    const [vector] = await this.embedDocuments([text]);
    return vector;
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const extractor = await getExtractor();
    const vectors: number[][] = [];

    for (const text of texts) {
      // mean-pooling + normalization, standard for sentence embeddings
      const output = await extractor(text, { pooling: "mean", normalize: true });
      vectors.push(Array.from(output.data as Float32Array));
    }

    return vectors;
  }
}
