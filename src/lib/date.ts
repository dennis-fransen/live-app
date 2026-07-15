// Date helpers. All "board" dates are plain YYYY-MM-DD strings anchored to the
// household timezone, so we compare them as strings / calendar dates and never
// as UTC instants.

export function todayInTimezone(timezone: string): string {
  // en-CA gives YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isOverdue(dueDate: string, today: string): boolean {
  return dueDate < today;
}

export function isToday(dueDate: string, today: string): boolean {
  return dueDate === today;
}

const WEEKDAY_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export function formatDue(dueDate: string, today: string): string {
  if (dueDate === today) return "Today";
  if (dueDate === addDays(today, 1)) return "Tomorrow";
  if (dueDate === addDays(today, -1)) return "Yesterday";
  return WEEKDAY_FMT.format(new Date(dueDate + "T00:00:00Z"));
}

export function relativeDayLabel(dueDate: string, today: string): string {
  if (dueDate < today) {
    const overdueDays = daysBetween(dueDate, today);
    return overdueDays === 1 ? "1 day overdue" : `${overdueDays} days overdue`;
  }
  return formatDue(dueDate, today);
}

export function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00Z").getTime();
  const db = new Date(b + "T00:00:00Z").getTime();
  return Math.round((db - da) / 86400000);
}
