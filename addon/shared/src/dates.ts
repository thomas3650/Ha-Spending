const DAY_MS = 86_400_000;

function toUtc(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

function fromUtc(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** A real calendar day as YYYY-MM-DD. */
export function isDate(value: string | undefined): value is string {
  if (value === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  // setUTCFullYear, unlike Date.UTC, keeps the years 0 to 99 as they are.
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function addDays(date: string, days: number): string {
  return fromUtc(toUtc(date) + days * DAY_MS);
}

/** Monday 1, Sunday 7. */
export function isoWeekday(date: string): number {
  return new Date(toUtc(date)).getUTCDay() || 7;
}

export function isoWeek(date: string): { year: number; week: number } {
  const thursday = toUtc(addDays(date, 4 - isoWeekday(date)));
  const year = new Date(thursday).getUTCFullYear();
  const week = Math.floor((thursday - Date.UTC(year, 0, 1)) / DAY_MS / 7) + 1;
  return { year, week };
}

/** Today in the process's time zone (the container's `TZ`), unlike every other function here. */
export function localToday(now: Date): string {
  return `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function firstOfMonth(year: number, month: number): string {
  return fromUtc(Date.UTC(year, month - 1, 1));
}
