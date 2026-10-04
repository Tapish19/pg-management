type Booking = { status: string; createdAt: string | null; id: string };

export function selectCurrentBooking<T extends Booking>(rows: T[]): T | null {
  const rank: Record<string, number> = { active: 0, confirmed: 1, pending: 2 };
  return [...rows]
    .filter((row) => Object.hasOwn(rank, row.status))
    .sort((a, b) => rank[a.status] - rank[b.status] ||
      (b.createdAt ?? "").localeCompare(a.createdAt ?? "") || b.id.localeCompare(a.id))[0] ?? null;
}
