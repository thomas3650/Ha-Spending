import {
  amountPerPayment,
  amountPerYear,
  compareKeys,
  type Level,
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
import type { Sorted, SubscriptionColumn } from "../state/view";

export const DEFAULT_SUBSCRIPTION_SORT: Sorted<SubscriptionColumn> = { column: "status", descending: false };

/** Kategori shows only at Alt forbrug; a kept sort on it elsewhere gives way to the default. */
export function shownSubscriptionSort(sort: Sorted<SubscriptionColumn>, level: Level["kind"]): Sorted<SubscriptionColumn> {
  return sort.column === "category" && level !== "all" ? DEFAULT_SUBSCRIPTION_SORT : sort;
}

export function subscriptionFirstDescending(column: SubscriptionColumn): boolean {
  return column === "amount" || column === "perYear";
}

export interface SubscriptionRow {
  id: string;
  name: string;
  objectGroup: string;
  /** "1. nov"; null: no next date. */
  next: string | null;
  /** "8.000 kr.", unbroken. */
  amount: string;
  /** "pr. måned", unbroken; the table shows it on its own line under the amount. */
  repeat: string;
  perYear: string;
  category: string;
  /** Øre, for sorting. */
  amountOre: number;
  perYearOre: number;
  /** The category when it is a known one; null shows as "Uden kategori". */
  categoryName: string | null;
  status: { kind: SubscriptionStatus["kind"]; text: string };
}

function unbroken(text: string): string {
  return text.replaceAll(" ", "\u00a0");
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

/** The Beløb cell's two lines, each unbroken. */
function paymentParts(s: Subscription): { amount: string; repeat: string } {
  return { amount: unbroken(kr(amountPerPayment(s))), repeat: unbroken(da.repeatText(s.repeat, s.skip)) };
}

/** "8.000 kr. pr. måned" on one line, which wraps only between the amount and its repeat. */
export function paymentText(s: Subscription): string {
  const { amount, repeat } = paymentParts(s);
  return `${amount} ${repeat}`;
}

export function statusCell(status: SubscriptionStatus, today: string): SubscriptionRow["status"] {
  return { kind: status.kind, text: statusText(status, today) };
}

export function billHref(base: string | null, id: string): string | null {
  return base === null ? null : `${base}/bills/show/${encodeURIComponent(id)}`;
}

function isDue(status: SubscriptionStatus, today: string): boolean {
  return status.kind === "expected" && status.date !== null && status.date < today;
}

/** Ikke set and Forfalden carry the date in the status, so the name cell shows no "næste". */
function statusShowsDate(status: SubscriptionStatus, today: string): boolean {
  return status.kind === "notSeen" || isDue(status, today);
}

function statusText(status: SubscriptionStatus, today: string): string {
  switch (status.kind) {
    case "notSeen":
      return da.status.notSeen(shortDate(status.expected, today));
    case "risen":
      return da.status.risen(...stepAmounts(status.max, status.paid));
    case "expected":
      if (status.date === null) return da.status.expected(null);
      return (isDue(status, today) ? da.status.due : da.status.expected)(shortDate(status.date, today));
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

export interface ObjectGroupSum {
  name: string;
  perYear: string;
}

export interface SubscriptionTable {
  objectGroups: ObjectGroupSum[];
  groups: SubscriptionGroup[] | null;
  showCategory: boolean;
  rows: SubscriptionRow[];
  /** The sort the rows have, which the headers show. */
  sort: Sorted<SubscriptionColumn>;
}

function compareBy(column: SubscriptionColumn, a: SubscriptionRow, b: SubscriptionRow, descending: boolean): number {
  const sign = descending ? -1 : 1;
  switch (column) {
    case "name":
      return sign * a.name.localeCompare(b.name, "da");
    case "category":
      if (a.categoryName === null || b.categoryName === null) {
        return Number(a.categoryName === null) - Number(b.categoryName === null);
      }
      return sign * a.categoryName.localeCompare(b.categoryName, "da");
    case "amount":
      return sign * (a.amountOre - b.amountOre);
    case "perYear":
      return sign * (a.perYearOre - b.perYearOre);
    case "status":
      return 0;
  }
}

/** Ties keep today's order, which `shown` gives; the status column is that order, turned around when descending. */
function sortItems<T extends { row: SubscriptionRow }>(items: T[], sort: Sorted<SubscriptionColumn>): T[] {
  if (sort.column === "status") return sort.descending ? [...items].reverse() : items;
  return [...items].sort((a, b) => compareBy(sort.column, a.row, b.row, sort.descending));
}

export function subscriptionTable(ctx: ViewContext, kept: Sorted<SubscriptionColumn>): SubscriptionTable {
  const kind = ctx.state.level.kind;
  const sort = shownSubscriptionSort(kept, kind);
  const today = ctx.data.today;
  const mainGroups = new Map(ctx.data.categories.map((c) => [c.name, c.mainGroup]));
  const unsorted = shown(ctx).map(({ subscription: s, next, status }) => {
    const last = s.lastPayment?.category ?? null;
    const known = last !== null && mainGroups.has(last);
    const row: SubscriptionRow = {
      id: s.id,
      name: s.name,
      objectGroup: s.objectGroup,
      next: next === null || statusShowsDate(status, today) ? null : shortDate(next, today),
      ...paymentParts(s),
      perYear: kr(amountPerYear(s)),
      category: known ? last : da.noCategory,
      amountOre: amountPerPayment(s),
      perYearOre: amountPerYear(s),
      categoryName: known ? last : null,
      status: statusCell(status, today),
    };
    return {
      row,
      year: amountPerYear(s),
      category: known ? last : null,
      mainGroup: known ? (mainGroups.get(last) ?? null) : null,
    };
  });
  const items = sortItems(unsorted, sort);
  const rows = items.map((i) => i.row);
  const sums = new Map<string, number>();
  for (const item of items) sums.set(item.row.objectGroup, (sums.get(item.row.objectGroup) ?? 0) + item.year);
  const objectGroups = [...sums]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "da"))
    .map(([name, year]) => ({ name, perYear: da.perYear(kr(year)) }));
  if (kind === "category") return { objectGroups, groups: null, showCategory: false, rows, sort };

  const of = kind === "all" ? "mainGroup" : "category";
  const colours = partColours(ctx);
  const byKey = new Map<string | null, { year: number; rows: SubscriptionRow[] }>();
  for (const item of items) {
    const key = of === "mainGroup" ? item.mainGroup : item.category;
    const group = byKey.get(key) ?? { year: 0, rows: [] };
    group.year += item.year;
    group.rows.push(item.row);
    byKey.set(key, group);
  }
  const groups = [...byKey]
    .map(([key, g]) => ({ key, name: partName(key, of), year: g.year, rows: g.rows }))
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
  return { objectGroups, groups, showCategory: kind === "all", rows, sort };
}

export function subscriptionRows(ctx: ViewContext): SubscriptionRow[] {
  return subscriptionTable(ctx, DEFAULT_SUBSCRIPTION_SORT).rows;
}
