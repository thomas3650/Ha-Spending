import {
  amountPerPayment,
  amountPerYear,
  compareKeys,
  nextDate,
  type Subscription,
  type SubscriptionStatus,
  subscriptionStatus,
} from "@ha-spending/shared";
import { kr, shortDate, stepAmounts } from "../format";
import { da } from "../i18n/da";
import type { ViewContext } from "./context";
import { linkBase } from "./postings";

export interface SubscriptionRow {
  id: string;
  name: string;
  /** "1. nov"; null: no next date. */
  next: string | null;
  amount: string;
  perYear: string;
  status: { kind: SubscriptionStatus["kind"]; text: string };
  href: string | null;
}

const STATUS_ORDER: Record<SubscriptionStatus["kind"], number> = { notSeen: 0, risen: 1, expected: 2, paid: 3 };

interface Shown {
  subscription: Subscription;
  next: string | null;
  status: SubscriptionStatus;
}

/** The answer's today, the day the subscriptions were read, so the statuses match the data (spec §2). */
function shown(ctx: ViewContext): Shown[] {
  const today = ctx.data.today;
  const mainGroups = new Map(ctx.data.categories.map((c) => [c.name, c.mainGroup]));
  const accounts = ctx.state.accounts === null ? null : new Set(ctx.state.accounts);
  const level = ctx.state.level;
  return ctx.data.subscriptions
    .filter((s) => {
      const last = s.lastPayment;
      if (last !== null && accounts !== null && !accounts.has(last.account)) return false;
      if (level.kind === "all") return true;
      const category = last?.category ?? null;
      const mainGroup = category === null ? null : (mainGroups.get(category) ?? null);
      if (mainGroup !== level.mainGroup) return false;
      return level.kind === "mainGroup" || category === level.category;
    })
    .map((s) => ({ subscription: s, next: nextDate(s, today), status: subscriptionStatus(s, today) }))
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status.kind] - STATUS_ORDER[b.status.kind] ||
        compareKeys(a.next, b.next) ||
        a.subscription.name.localeCompare(b.subscription.name, "da"),
    );
}

export function shownSubscriptions(ctx: ViewContext): Subscription[] {
  return shown(ctx).map((s) => s.subscription);
}

export function subscriptionsYear(ctx: ViewContext): number {
  return shownSubscriptions(ctx).reduce((sum, s) => sum + amountPerYear(s), 0);
}

function statusText(status: SubscriptionStatus, today: string): string {
  switch (status.kind) {
    case "notSeen":
      return da.status.notSeen(shortDate(status.expected, today));
    case "risen":
      return da.status.risen(...stepAmounts(status.max, status.paid));
    case "expected":
      return da.status.expected(status.date === null ? null : shortDate(status.date, today));
    case "paid":
      return da.status.paid(shortDate(status.date, today));
  }
}

export function subscriptionRows(ctx: ViewContext): SubscriptionRow[] {
  const today = ctx.data.today;
  const base = linkBase(ctx.data.fireflyLinkUrl);
  return shown(ctx).map(({ subscription: s, next, status }) => ({
    id: s.id,
    name: s.name,
    next: next === null ? null : shortDate(next, today),
    amount: `${kr(amountPerPayment(s))} ${da.repeatText(s.repeat, s.skip)}`,
    perYear: kr(amountPerYear(s)),
    status: { kind: status.kind, text: statusText(status, today) },
    href: base === null ? null : `${base}/bills/show/${encodeURIComponent(s.id)}`,
  }));
}
