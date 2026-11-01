import {
  amountPerPayment,
  amountPerYear,
  compareKeys,
  NO_PIECE,
  nextDate,
  type Subscription,
  type SubscriptionStatus,
  subscriptionStatus,
} from "@ha-spending/shared";
import { kr, shortDate, stepAmounts } from "../format";
import { da } from "../i18n/da";
import { partColours } from "./circle";
import { partName, type ViewContext } from "./context";
import { linkBase } from "./postings";

export interface SubscriptionRow {
  id: string;
  name: string;
  /** "1. nov"; null: no next date. */
  next: string | null;
  /** "8.000 kr. pr. måned", which wraps only between the amount and its repeat. */
  amount: string;
  perYear: string;
  category: string;
  status: { kind: SubscriptionStatus["kind"]; text: string };
  href: string | null;
}

function unbroken(text: string): string {
  return text.replaceAll(" ", "\u00a0");
}

const STATUS_ORDER: Record<SubscriptionStatus["kind"], number> = {
  notSeen: 0,
  risen: 1,
  expected: 2,
  paid: 3,
};

interface Shown {
  subscription: Subscription;
  next: string | null;
  status: SubscriptionStatus;
}

/** The answer's today, the day the subscriptions were read, so the statuses match the data (spec §2). */
function shown(ctx: ViewContext): Shown[] {
  const today = ctx.data.today;
  const mainGroups = new Map(
    ctx.data.categories.map((c) => [c.name, c.mainGroup]),
  );
  const accounts =
    ctx.state.accounts === null ? null : new Set(ctx.state.accounts);
  const level = ctx.state.level;
  return ctx.data.subscriptions
    .filter((s) => {
      const last = s.lastPayment;
      if (last !== null && accounts !== null && !accounts.has(last.account))
        return false;
      if (level.kind === "all") return true;
      const category = last?.category ?? null;
      const mainGroup =
        category === null ? null : (mainGroups.get(category) ?? null);
      if (mainGroup !== level.mainGroup) return false;
      return level.kind === "mainGroup" || category === level.category;
    })
    .map((s) => ({
      subscription: s,
      next: nextDate(s, today),
      status: subscriptionStatus(s, today),
    }))
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
      return da.status.expected(
        status.date === null ? null : shortDate(status.date, today),
      );
    case "paid":
      return da.status.paid(shortDate(status.date, today));
  }
}

export interface SubscriptionGroup {
  key: string | null;
  name: string;
  colour: string;
  count: string;
  perYear: string;
  rows: SubscriptionRow[];
}

export interface SubscriptionTable {
  groups: SubscriptionGroup[] | null;
  showCategory: boolean;
  rows: SubscriptionRow[];
}

export function subscriptionTable(ctx: ViewContext): SubscriptionTable {
  const today = ctx.data.today;
  const base = linkBase(ctx.data.fireflyLinkUrl);
  const mainGroups = new Map(
    ctx.data.categories.map((c) => [c.name, c.mainGroup]),
  );
  const items = shown(ctx).map(({ subscription: s, next, status }) => {
    const last = s.lastPayment?.category ?? null;
    const known = last !== null && mainGroups.has(last);
    const row: SubscriptionRow = {
      id: s.id,
      name: s.name,
      next: next === null ? null : shortDate(next, today),
      amount: `${unbroken(kr(amountPerPayment(s)))} ${unbroken(da.repeatText(s.repeat, s.skip))}`,
      perYear: kr(amountPerYear(s)),
      category: known ? last : da.noCategory,
      status: { kind: status.kind, text: statusText(status, today) },
      href:
        base === null ? null : `${base}/bills/show/${encodeURIComponent(s.id)}`,
    };
    return {
      row,
      year: amountPerYear(s),
      category: known ? last : null,
      mainGroup: known ? (mainGroups.get(last) ?? null) : null,
    };
  });
  const rows = items.map((i) => i.row);
  const kind = ctx.state.level.kind;
  if (kind === "category") return { groups: null, showCategory: false, rows };

  const of = kind === "all" ? "mainGroup" : "category";
  const colours = partColours(ctx);
  const byKey = new Map<
    string | null,
    { year: number; rows: SubscriptionRow[] }
  >();
  for (const item of items) {
    const key = of === "mainGroup" ? item.mainGroup : item.category;
    const group = byKey.get(key) ?? { year: 0, rows: [] };
    group.year += item.year;
    group.rows.push(item.row);
    byKey.set(key, group);
  }
  const groups = [...byKey]
    .map(([key, g]) => ({
      key,
      name: partName(key, of),
      year: g.year,
      rows: g.rows,
    }))
    .sort(
      (a, b) =>
        Number(a.key === null) - Number(b.key === null) ||
        b.year - a.year ||
        a.name.localeCompare(b.name, "da"),
    )
    .map((g): SubscriptionGroup => ({
      key: g.key,
      name: g.name,
      colour: colours.get(g.key) ?? NO_PIECE,
      count: da.subscriptionCount(g.rows.length),
      perYear: kr(g.year),
      rows: g.rows,
    }));
  return { groups, showCategory: kind === "all", rows };
}

export function subscriptionRows(ctx: ViewContext): SubscriptionRow[] {
  return subscriptionTable(ctx).rows;
}
