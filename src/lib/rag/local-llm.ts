import { pipeline, type Text2TextGenerationPipeline } from "@xenova/transformers";

// Small, free, local instruction-tuned model for answer generation — no API
// key required. LaMini-Flan-T5 is a distilled instruction-following model
// (248M params) that runs acceptably on CPU and is commonly used for local
// RAG demos where hitting a paid LLM API isn't an option.
//
// Swap-in point: to use a hosted model instead (OpenAI / Anthropic / etc.)
// for higher answer quality, replace `generateAnswer` below with a call to
// that provider's chat completions endpoint using the same prompt — the
// retrieval half of the pipeline (Chroma + LocalEmbeddings) stays identical.
const MODEL_NAME = "Xenova/LaMini-Flan-T5-248M";

let generatorPromise: Promise<Text2TextGenerationPipeline> | null = null;

function getGenerator(): Promise<Text2TextGenerationPipeline> {
  if (!generatorPromise) {
    generatorPromise = pipeline("text2text-generation", MODEL_NAME) as Promise<Text2TextGenerationPipeline>;
  }
  return generatorPromise;
}

export async function generateAnswer(question: string, contextChunks: string[]): Promise<string> {
  const generator = await getGenerator();

  const context = contextChunks.map((c, i) => `[${i + 1}] ${c}`).join("\n\n");

  const prompt = [
    "You are a helpful hostel assistant. Answer the tenant's question using ONLY the context below.",
    "If the answer isn't in the context, say you don't have that information and suggest contacting staff.",
    "Be concise (2-4 sentences).",
    "",
    `Context:\n${context}`,
    "",
    `Question: ${question}`,
    "Answer:",
  ].join("\n");

  const output = await generator(prompt, {
    max_new_tokens: 200,
    temperature: 0.3,
  });

  const result = Array.isArray(output) ? output[0] : output;
  return (result as { generated_text: string }).generated_text.trim();
}
