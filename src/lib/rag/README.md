# RAG Assistant — Setup & Notes

Real LangChain.js + Chroma implementation, using local (no API key) embeddings
and generation, so it works out of the box with zero cloud accounts.

## What's actually running here

- **Orchestration:** `langchain` / `@langchain/community` (`RecursiveCharacterTextSplitter`, `Chroma` vector store wrapper).
- **Vector DB:** Chroma, run as a local server.
- **Embeddings:** `Xenova/all-MiniLM-L6-v2` via `@xenova/transformers` — runs on-device, no API key, no cost.
- **Generation:** `Xenova/LaMini-Flan-T5-248M`, also local. Swap for a hosted model (OpenAI/Anthropic) in `local-llm.ts` if you want materially better answer quality — the retrieval half doesn't change.

## One-time setup

```bash
# 1. Install & run a local Chroma server (needs Python)
pip install chromadb
chroma run --path ./chroma-data
# leave this running in a separate terminal — defaults to http://localhost:8000

# 2. Ingest the hostel policy docs (content/hostel-docs/*.md) into Chroma
#    First run downloads the embedding model (~90MB) from Hugging Face and
#    caches it locally — needs internet once, then works offline.
npx tsx src/lib/rag/ingest.ts
```

Then the `/my-assistant` route (tenant-facing chat) and the `askAssistantFn`
server function are live.

## Re-grounding the resume claim

Don't put "resolves 70%+ of tenant queries without staff intervention" on a
resume without a number you can defend. Run:

```bash
npx tsx src/lib/rag/eval.ts
```

This runs a small labeled query set (`eval.ts`) — a mix of questions that
*are* covered by the policy docs and ones that deliberately aren't — and
prints the real resolution rate plus how often the assistant correctly
decided to escalate rather than guess. Use that printed number, and grow the
eval set with real tenant questions once the assistant is in production, so
the metric is measured, not guessed.

## Design choice: confidence threshold, not "answer no matter what"

`chain.ts` only answers when top-retrieved-chunk similarity clears
`RELEVANCE_THRESHOLD` (currently 0.45, tuned against `eval.ts`). Below that,
it escalates instead of hallucinating an answer. This is what makes the
"without staff intervention" claim honest — the system knows what it doesn't
know, rather than confidently answering everything.

## What would change for a portfolio vs. production deployment

This is wired for a real, runnable local setup. For a hosted deployment,
swap `CHROMA_URL` for a managed Chroma Cloud instance or Pinecone (the
LangChain `VectorStore` interface makes that a drop-in), and swap
`local-llm.ts`'s generator for a hosted LLM call for materially better answer
quality.
