import {
  amountPerYear,
  type ClassifiedPosting,
  type Subscription,
  type SubscriptionStatus,
  subscriptionStatus,
  total,
  unitTotals,
  within,
} from "@ha-spending/shared";
import { count, detailAmount, detailKr, tableDate, unitAxis, unitName } from "../format";
import { da } from "../i18n/da";
import type { DetailKey } from "../state/view";
import { partName, type ViewContext } from "./context";
import { byDate } from "./filter";
import { linkBase, postingHref } from "./postings";
import { billHref, paymentText, statusCell } from "./subscriptions";

export interface DetailBox {
  label: string;
  value: string;
  count?: string;
}

export interface DetailBar {
  name: string;
  /** Øre, net; a unit at zero or below keeps its place but draws no bar. */
  amount: number;
  label: string;
}

export interface DetailRow {
  id: string;
  date: string;
  account: string;
  amount: string;
  marked: boolean;
  href: string | null;
}

export interface DetailView {
  kind: "subscription" | "shop";
  /** What opened it, for the row marks and the focus. */
  key: DetailKey;
  context: string;
  title: string;
  amount: string;
  /** A subscription's only. */
  status: { kind: SubscriptionStatus["kind"]; text: string } | null;
  /** A shop's only: the date and, with a shop, the bank's text. */
  aside: string | null;
  boxes: [DetailBox, DetailBox, DetailBox];
  per: string;
  bars: DetailBar[];
  /** Newest first, all of them. */
  rows: DetailRow[];
  href: string | null;
}

interface Common {
  rows: DetailRow[];
  bars: DetailBar[];
  first: DetailBox;
  per: string;
}

function common(ctx: ViewContext, rows: ClassifiedPosting[], marked: string | null): Common {
  const g = ctx.timeline.grouping;
  const base = linkBase(ctx.data.fireflyLinkUrl);
  const totals = unitTotals(rows, ctx.units);
  return {
    rows: [...rows]
      .sort((a, b) => byDate(b, a))
      .map((p) => ({
        id: p.id,
        date: tableDate(p.date),
        account: accountName(ctx, p.account),
        amount: detailAmount(p.amount),
        marked: p.id === marked,
        href: postingHref(base, p),
      })),
    bars: ctx.units.map((unit, i) => ({
      name: unitAxis(unit, g),
      amount: totals[i],
      label: `${unitName(unit, g)}: ${detailKr(totals[i])}`,
    })),
    first: {
      label: da.detailInPeriod,
      value: detailKr(total(rows)),
      count: count(rows.length),
    },
    per: da.detailPer(g),
  };
}

function accountName(ctx: ViewContext, id: string): string {
  return ctx.data.accounts.find((a) => a.id === id)?.name ?? id;
}

function subscriptionView(
  s: Subscription,
  key: DetailKey,
  marked: string | null,
  inPeriod: ClassifiedPosting[],
  ctx: ViewContext,
): DetailView {
  const c = common(
    ctx,
    inPeriod.filter((p) => p.subscription?.id === s.id),
    marked,
  );
  const last = s.lastPayment;
  const category = last?.category ?? null;
  const mainGroup = category === null ? null : (ctx.data.categories.find((x) => x.name === category)?.mainGroup ?? null);
  return {
    kind: "subscription",
    key,
    context: last === null ? s.objectGroup : `${partName(mainGroup, "mainGroup")} · ${s.objectGroup}`,
    title: s.name,
    amount: paymentText(s),
    status: statusCell(subscriptionStatus(s, ctx.data.today), ctx.data.today),
    aside: null,
    boxes: [
      c.first,
      { label: da.subscriptionColumns.perYear, value: detailKr(amountPerYear(s)) },
      { label: da.columns.account, value: last === null ? da.noAccount : accountName(ctx, last.account) },
    ],
    per: c.per,
    bars: c.bars,
    rows: c.rows,
    href: billHref(linkBase(ctx.data.fireflyLinkUrl), s.id),
  };
}

function shopView(p: ClassifiedPosting, key: DetailKey, inPeriod: ClassifiedPosting[], ctx: ViewContext): DetailView {
  const same = inPeriod.filter((q) => (p.shop === null ? q.shop === null && q.text === p.text : q.shop === p.shop));
  const c = common(ctx, same, p.id);
  return {
    kind: "shop",
    key,
    context: da.shopContext,
    title: p.shop ?? p.text,
    amount: detailAmount(p.amount),
    status: null,
    aside: p.shop === null ? tableDate(p.date) : `${tableDate(p.date)} · ${p.text}`,
    boxes: [
      c.first,
      { label: da.columns.account, value: accountName(ctx, p.account) },
      { label: da.columns.category, value: partName(p.category, "category") },
    ],
    per: c.per,
    bars: c.bars,
    rows: c.rows,
    href: postingHref(linkBase(ctx.data.fireflyLinkUrl), p),
  };
}

/** null when the key finds nothing: an unknown bill, or a posting outside the period or the ticked accounts. */
export function detailView(key: DetailKey, ctx: ViewContext): DetailView | null {
  // The period, never the chosen unit, and every level: the detail is about the whole bill or shop (spec §3).
  const inPeriod = within(ctx.postings, ctx.timeline.period);
  const bill = (id: string) => ctx.data.subscriptions.find((s) => s.id === id);
  if (key.kind === "subscription") {
    const s = bill(key.id);
    return s === undefined ? null : subscriptionView(s, key, null, inPeriod, ctx);
  }
  const p = inPeriod.find((q) => q.id === key.id);
  if (p === undefined) return null;
  const s = p.subscription === null ? undefined : bill(p.subscription.id);
  return s === undefined ? shopView(p, key, inPeriod, ctx) : subscriptionView(s, key, p.id, inPeriod, ctx);
}
