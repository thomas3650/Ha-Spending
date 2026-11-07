import {
  chosenUnitNumbers,
  keyNumbers,
  type LeftOverData,
  paidPerMonth,
  type Period,
  share,
  type Unit,
  within,
} from "@ha-spending/shared";
import { kr, percent, rangeText, unitName } from "../format";
import { da } from "../i18n/da";
import type { ViewState } from "../state/view";
import { levelName, type ViewContext } from "./context";
import { tabTime } from "./fixed";
import { leftOverCard, MINUS } from "./left-over";
import { paymentsByBill, ranIn, tabRows } from "./subscriptions";

/** The line under a key number's value; `href` is the hash it opens, and the app handles the click itself. */
export type KeyLink =
  | { kind: "postings"; count: number; href: string }
  | { kind: "subscriptions"; objectGroup: string; href: string }
  | { kind: "leftOver"; href: string };

export interface KeyCard {
  label: string;
  value: string;
  sub: string;
  link?: KeyLink;
  /** The value is an estimate, which the card marks with "ca.". */
  estimate?: boolean;
  /** The card's own answer is still loading, so only its label is known. */
  busy?: true;
}

/** ctx.parentTotal is already the chosen unit's when one is chosen. */
function shareSub(ctx: ViewContext, amount: number, range: Period): string {
  if (ctx.parentLevel === null) return rangeText(range);
  const fraction = ctx.parentTotal === null ? null : share(amount, ctx.parentTotal);
  if (fraction === null) return da.none;
  return ctx.parentLevel.kind === "all"
    ? da.shareOfAll(percent(fraction))
    : da.shareOf(percent(fraction), levelName(ctx.parentLevel));
}

function periodCards(ctx: ViewContext): [KeyCard, KeyCard] {
  const g = ctx.timeline.grouping;
  const numbers = keyNumbers(ctx.shown, ctx.timeline);
  const level = ctx.state.level;

  const first: KeyCard = {
    label: level.kind === "all" ? da.spendingInPeriod : da.inPeriod(levelName(level)),
    value: kr(numbers.total),
    sub: shareSub(ctx, numbers.total, ctx.timeline.period),
  };

  const avg = numbers.average;
  const second: KeyCard = {
    label: da.averagePer(g),
    value: avg.amount === null ? da.none : kr(avg.amount),
    sub:
      avg.basis === "period"
        ? da.unitCount(avg.units, g)
        : avg.units === 0
          ? da.noDataBefore
          : da.averageBefore(avg.units, g),
  };

  return [first, second];
}

function unitCards(ctx: ViewContext, unit: Unit): [KeyCard] {
  const g = ctx.timeline.grouping;
  const numbers = chosenUnitNumbers(ctx.shown, ctx.timeline, unit);
  const level = ctx.state.level;
  const name = unitName(unit, g, ctx.unitYear);

  const first: KeyCard = {
    label: level.kind === "all" ? da.unitTotal(name) : da.levelInUnit(levelName(level), name),
    value: kr(numbers.amount),
    sub: shareSub(ctx, numbers.amount, { start: unit.start, end: unit.end }),
  };

  return [first];
}

export function keyCards(ctx: ViewContext, href: string): KeyCard[] {
  const [first, ...rest] = ctx.chosen === null ? periodCards(ctx) : unitCards(ctx, ctx.chosen);
  const count = within(ctx.shown, ctx.chosen ?? ctx.timeline.period).length;
  return [{ ...first, link: { kind: "postings", count, href } }, ...rest];
}

/**
 * Til overs is about the household's accounts as a whole; a main group, a category or chosen accounts narrow the
 * spending only, so Ind and Forbrug would disagree (spec §2.1).
 */
export function showsLeftOver(s: ViewState): boolean {
  return s.level.kind === "all" && s.accounts === null;
}

/** Busy while `data` is null. Like every key number its value has no colour and no "+" (D53). */
export function leftOverKeyCard(ctx: ViewContext, data: LeftOverData | null, href: string): KeyCard {
  const chosen = ctx.chosen;
  const label = da.leftOver.label(chosen === null ? null : unitName(chosen, ctx.timeline.grouping, ctx.unitYear));
  if (data === null) return { label, value: "", sub: "", busy: true };
  const { leftOver, paidIn, borrowed } = leftOverCard(data, chosen ?? ctx.timeline.period);
  return {
    label,
    value: leftOver < 0 ? `${MINUS}${kr(leftOver)}` : kr(leftOver),
    sub: da.leftOver.paidInSub(kr(paidIn)) + (borrowed === null ? "" : da.leftOver.borrowedSub(kr(borrowed))),
    link: { kind: "leftOver", href },
  };
}

/**
 * The object groups of the bills that ran in the period's tab time, and of the shown postings in the period, unsorted.
 * A kept bill that ended before the period adds none (fixed list tab spec §4.2).
 */
export function objectGroupNames(ctx: ViewContext): string[] {
  const time = tabTime(ctx.data, { ...ctx.state, unit: null }, ctx.today);
  const payments = paymentsByBill(ctx.postings);
  const ran = ctx.data.subscriptions.filter((s) => ranIn(s, time, payments.get(s.id) ?? [])).map((s) => s.objectGroup);
  const inPeriod = within(ctx.shown, ctx.timeline.period).flatMap((p) =>
    p.subscription === null ? [] : [p.subscription.objectGroup],
  );
  return [...new Set([...ran, ...inPeriod])];
}

/** The card's line by whether the group has payments and rows (fixed list tab spec §5). */
function objectGroupLine(hasPayments: boolean, rows: number, average: string | null): string {
  if (!hasPayments) return rows === 0 ? da.noPayments : da.noPaymentsCount(rows);
  if (rows === 0) return average ?? "";
  return average === null ? da.billCount(rows) : `${average} · ${da.billCount(rows)}`;
}

/**
 * One card per object group of `objectGroupNames`; empty gives the period's key numbers only (spec §4). The set of
 * groups is the period's; with a chosen unit the payments and the count narrow to it. "X stk." is the Alle faste
 * udgifter tab's rows for the group. Each links to the fixed-expenses view on its own group, which exists only when
 * the answer has bills.
 */
export function objectGroupCards(ctx: ViewContext, hrefFor: (group: string) => string): KeyCard[] {
  const period = ctx.timeline.period;
  const counted = ctx.chosen ?? period;
  const unit = ctx.chosen === null ? null : unitName(ctx.chosen, ctx.timeline.grouping, ctx.unitYear);
  const linked = within(ctx.shown, counted).flatMap((p) =>
    p.subscription === null ? [] : [{ group: p.subscription.objectGroup, amount: p.amount, date: p.date }],
  );
  const rows = tabRows({ ...ctx, state: { ...ctx.state, objectGroup: null } });
  const names = objectGroupNames(ctx);
  const withLink = ctx.data.subscriptions.length > 0;
  return names
    .sort((a, b) => a.localeCompare(b, "da"))
    .map((name) => {
      const payments = linked.filter((l) => l.group === name);
      const count = rows.filter((r) => r.subscription.objectGroup === name).length;
      const sum = payments.reduce((acc, l) => acc + l.amount, 0);
      const average = paidPerMonth(payments, ctx.timeline);
      const perMonthText = unit !== null || average === null ? null : da.perMonth(kr(average.amount));
      return {
        label: unit === null ? da.inPeriod(name) : da.levelInUnit(name, unit),
        value: kr(sum),
        sub: objectGroupLine(payments.length > 0, count, perMonthText),
        link: withLink ? { kind: "subscriptions", objectGroup: name, href: hrefFor(name) } : undefined,
      };
    });
}
