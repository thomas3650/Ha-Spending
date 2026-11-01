import { addDays, addMonths } from "./dates";
import type { Repeat, Subscription } from "./types";

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

export function amountPerPayment(s: Subscription): number {
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
  if (last && last.amount > s.amountMax) return { kind: "risen", max: s.amountMax, paid: last.amount };
  if (!last || (next !== null && next <= addDays(today, ahead))) return { kind: "expected", date: next };
  return { kind: "paid", date: last.date };
}
