export function cosineSimilarity(query: number[], document: number[]): number {
  if (!query.length || query.length !== document.length) return 0;
  let dot = 0,
    queryNorm = 0,
    documentNorm = 0;
  for (let i = 0; i < query.length; i++) {
    if (!Number.isFinite(query[i]) || !Number.isFinite(document[i])) return 0;
    dot += query[i] * document[i];
    queryNorm += query[i] ** 2;
    documentNorm += document[i] ** 2;
  }
  if (!queryNorm || !documentNorm) return 0;
  const score = dot / Math.sqrt(queryNorm * documentNorm);
  return Number.isFinite(score) ? Math.max(-1, Math.min(1, score)) : 0;
}

export function rankRelevantDocuments<T>(
  query: number[],
  documents: T[],
  vectors: number[][],
  threshold: number,
) {
  const ranked = documents
    .map((document, index) => ({ document, score: cosineSimilarity(query, vectors[index] ?? []) }))
    .sort((a, b) => b.score - a.score);
  return {
    topScore: ranked[0]?.score ?? 0,
    documents: ranked.filter((item) => item.score >= threshold).map((item) => item.document),
  };
}
