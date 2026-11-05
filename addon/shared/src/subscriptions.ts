import { addDays, addMonths } from "./dates";
import type { Period, Posting, Repeat, Subscription } from "./types";

export const PAYMENTS_PER_YEAR: Record<Repeat, number> = {
  weekly: 52,
  monthly: 12,
  quarterly: 4,
  "half-year": 2,
  yearly: 1,
};

export const MAX_GAP_MONTHS = 24;

const MONTHS_PER_PERIOD: Record<Exclude<Repeat, "weekly">, number> = {
  monthly: 1,
  quarterly: 3,
  "half-year": 6,
  yearly: 12,
};

/** Days a payment may come early, may be late, and how far ahead "expected" reaches. */
const DAYS = {
  weekly: { early: 2, late: 2, ahead: 3 },
  other: { early: 7, late: 5, ahead: 7 },
};

function days(repeat: Repeat): { early: number; late: number; ahead: number } {
  return repeat === "weekly" ? DAYS.weekly : DAYS.other;
}

export function gapMonths(repeat: Repeat, skip: number): number {
  if (repeat === "weekly") return ((skip + 1) * 7) / 30;
  return MONTHS_PER_PERIOD[repeat] * (skip + 1);
}

/** øre: a last payment at least this far above the range's max counts as a rise. */
const RISE_THRESHOLD = 100;

function risen(s: Subscription): s is Subscription & { lastPayment: NonNullable<Subscription["lastPayment"]> } {
  return s.lastPayment !== null && s.lastPayment.amount >= s.amountMax + RISE_THRESHOLD;
}

export function amountPerPayment(s: Subscription): number {
  if (risen(s)) return s.lastPayment.amount;
  return Math.round((s.amountMin + s.amountMax) / 2);
}

export function amountPerYear(s: Subscription): number {
  return Math.round((amountPerPayment(s) * PAYMENTS_PER_YEAR[s.repeat]) / (s.skip + 1));
}

function dueDate(s: Subscription, k: number): string {
  if (s.repeat === "weekly") return addDays(s.start, 7 * k * (s.skip + 1));
  return addMonths(s.start, k * MONTHS_PER_PERIOD[s.repeat] * (s.skip + 1));
}

export function nextDate(s: Subscription, today: string): string | null {
  let date: string;
  if (s.lastPayment) {
    const threshold = addDays(s.lastPayment.date, days(s.repeat).early);
    let k = 0;
    while (dueDate(s, k) <= threshold) k++;
    date = dueDate(s, k);
  } else if (s.start > today) {
    date = s.start;
  } else {
    let k = 0;
    while (dueDate(s, k + 1) <= today) k++;
    date = dueDate(s, k);
  }
  return s.end !== null && date > s.end ? null : date;
}

export function dueDatesUntil(s: Subscription, today: string, until: string): string[] {
  const first = nextDate(s, today);
  if (first === null) return [];
  let k = 0;
  while (dueDate(s, k) < first) k++;
  const dates: string[] = [];
  for (let date = dueDate(s, k); date <= until && (s.end === null || date <= s.end); date = dueDate(s, ++k)) {
    dates.push(date);
  }
  return dates;
}

export type SubscriptionStatus =
  | { kind: "notSeen"; expected: string }
  | { kind: "risen"; max: number; paid: number }
  | { kind: "expected"; date: string | null }
  | { kind: "paid"; date: string };

export function subscriptionStatus(s: Subscription, today: string): SubscriptionStatus {
  const { late, ahead } = days(s.repeat);
  const next = nextDate(s, today);
  const last = s.lastPayment;
  if (next !== null && addDays(next, late) < today) return { kind: "notSeen", expected: next };
  if (risen(s)) return { kind: "risen", max: s.amountMax, paid: s.lastPayment.amount };
  if (!last || (next !== null && next <= addDays(today, ahead))) return { kind: "expected", date: next };
  return { kind: "paid", date: last.date };
}

export function dueDatesBetween(s: Subscription, from: string, to: string): string[] {
  const dates: string[] = [];
  for (let k = 0, date = dueDate(s, 0); date <= to && (s.end === null || date <= s.end); date = dueDate(s, ++k)) {
    if (date >= from) dates.push(date);
  }
  return dates;
}

export type TimeStatus = SubscriptionStatus | { kind: "next"; date: string } | { kind: "ended"; end: string };

export function statusInTime(
  s: Subscription,
  payments: readonly Pick<Posting, "date" | "amount" | "kind">[],
  time: Period,
  fetched: Period,
  today: string,
): TimeStatus {
  if (time.end >= today) {
    if (s.end !== null && s.end < today && nextDate(s, today) === null) return { kind: "ended", end: s.end };
    return subscriptionStatus(s, today);
  }

  const { early, late } = days(s.repeat);
  const paidDates = payments.filter((p) => p.kind === "spending").map((p) => p.date);
  let missed: string | null = null;
  let open: string | null = null;
  let latestMet: string | null = null;
  for (const due of dueDatesBetween(s, time.start, time.end)) {
    const from = addDays(due, -early);
    const to = addDays(due, late);
    const met = paidDates.filter((date) => date >= from && date <= to);
    if (met.length > 0) {
      const latest = met.reduce((a, b) => (a > b ? a : b));
      if (latestMet === null || latest > latestMet) latestMet = latest;
    } else if (to >= today) {
      open ??= due;
    } else if (from >= fetched.start && to <= fetched.end) {
      missed ??= due;
    }
  }

  if (missed !== null) return { kind: "notSeen", expected: missed };
  if (open !== null) return { kind: "expected", date: open };
  if (s.end !== null && s.end <= time.end) return { kind: "ended", end: s.end };
  if (latestMet !== null) return { kind: "paid", date: latestMet };
  const inTime = paidDates.filter((date) => date >= time.start && date <= time.end);
  if (inTime.length > 0) return { kind: "paid", date: inTime.reduce((a, b) => (a > b ? a : b)) };
  const next = dueDatesBetween(s, addDays(time.end, 1), addMonths(time.end, MAX_GAP_MONTHS + 1))[0];
  if (next !== undefined) return { kind: "next", date: next };
  if (s.end !== null) return { kind: "ended", end: s.end };
  // The server leaves out a bill with more than MAX_GAP_MONTHS between payments, so one without an end has a next date.
  return { kind: "expected", date: null };
}
