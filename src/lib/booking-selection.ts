type Booking = { status: string; createdAt: string | null; id: string };

export function selectCurrentBooking<T extends Booking>(rows: T[]): T | null {
  const rank: Record<string, number> = { active: 0, confirmed: 1, pending: 2 };
  return [...rows]
    .filter((row) => Object.hasOwn(rank, row.status))
    .sort((a, b) => rank[a.status] - rank[b.status] ||
      (b.createdAt ?? "").localeCompare(a.createdAt ?? "") || b.id.localeCompare(a.id))[0] ?? null;
}

export function newestFirst<T extends { createdAt: string | null; id: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "") || b.id.localeCompare(a.id));
}

export function distinctTenantBookings<T extends Booking & { tenantId: string }>(rows: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) groups.set(row.tenantId, [...(groups.get(row.tenantId) ?? []), row]);
  return [...groups.values()].map((group) => selectCurrentBooking(group) ?? newestFirst(group)[0]);
}
