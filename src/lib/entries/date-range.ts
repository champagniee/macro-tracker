// No per-user timezone is stored anywhere in this app yet, so a "day" boundary
// here is the UTC calendar date matching the YYYY-MM-DD string — accurate for
// users near UTC, off by hours near the date line otherwise. A known
// simplification, not a hidden one; revisit if/when user timezone is tracked.
export function dayRangeUtc(dateStr: string): { start: Date; end: Date } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const start = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export function todayUtcString(): string {
  return new Date().toISOString().slice(0, 10);
}
