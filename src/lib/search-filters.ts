export function parseBrowseSearch(search: Record<string, unknown>): { q?: string; sharing?: number; budget?: number } {
  const sharing = Number(search.sharing);
  const budget = Number(search.budget);
  return {
    q: typeof search.q === "string" ? search.q.trim().slice(0, 200) : undefined,
    sharing: Number.isInteger(sharing) && sharing >= 1 && sharing <= 4 ? sharing : undefined,
    budget: search.budget !== undefined && search.budget !== "" && Number.isFinite(budget) && budget >= 0 && budget <= 1000000 ? budget : undefined,
  };
}

export function includesSearch(query: string, ...values: unknown[]): boolean {
  return values.map((value) => String(value ?? "")).join(" ").toLowerCase().includes(query.trim().toLowerCase());
}
