export type AttendanceStatus = "present" | "absent" | "on-leave";
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export function attendanceSummary(records: { date: string; status: string }[], month: string) {
  const days = records.filter((record) => record.date.slice(0, 7) === month);
  const worked = days.filter((record) => record.status === "present").length;
  return {
    percentage: days.length ? Math.round((worked / days.length) * 100) : null,
    days: days.length,
  };
}
