import { change, chosenUnitNumbers, type Grouping, keyNumbers, type Period, share, type Unit } from "@ha-spending/shared";
import { comparisonLabel, kr, percent, rangeText, signedPercent, unitName } from "../format";
import { da } from "../i18n/da";
import { levelName, type ViewContext } from "./context";
import { shownSubscriptions, subscriptionsYear } from "./subscriptions";

export interface KeyCard {
  label: string;
  value: string;
  sub: string;
  trend: "up" | "down" | null;
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

function comparisonCard(unit: Unit, amount: number, before: Unit, beforeAmount: number | null, g: Grouping): KeyCard {
  const label = comparisonLabel(unit, before, g);
  if (beforeAmount === null) return { label, value: da.none, sub: da.noData(unitName(before, g)), trend: null };
  const diff = amount - beforeAmount;
  const ratio = change(amount, beforeAmount);
  return {
    label,
    value: ratio === null ? da.none : signedPercent(ratio),
    sub: arrowed(diff),
    trend: trendOf(diff),
  };
}

function arrowed(diff: number): string {
  return diff > 0 ? `${da.up} ${kr(diff)}` : diff < 0 ? `${da.down} ${kr(diff)}` : kr(0);
}

function trendOf(diff: number): KeyCard["trend"] {
  return diff > 0 ? "up" : diff < 0 ? "down" : null;
}

function periodCards(ctx: ViewContext): [KeyCard, KeyCard, KeyCard] {
  const g = ctx.timeline.grouping;
  const numbers = keyNumbers(ctx.shown, ctx.timeline);
  const level = ctx.state.level;

  const first: KeyCard = {
    label: level.kind === "all" ? da.spendingInPeriod : da.inPeriod(levelName(level)),
    value: kr(numbers.total),
    sub: shareSub(ctx, numbers.total, ctx.timeline.period),
    trend: null,
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
    trend: null,
  };

  const c = numbers.comparison;
  const third: KeyCard = c
    ? comparisonCard(c.unit, c.amount, c.before, c.beforeAmount, g)
    : { label: `${da.none} ${da.against} ${da.none}`, value: da.none, sub: "", trend: null };
  return [first, second, third];
}

function unitCards(ctx: ViewContext, unit: Unit): [KeyCard, KeyCard, KeyCard] {
  const g = ctx.timeline.grouping;
  const numbers = chosenUnitNumbers(ctx.shown, ctx.timeline, unit);
  const level = ctx.state.level;
  const name = unitName(unit, g);

  const first: KeyCard = {
    label: level.kind === "all" ? da.unitTotal(name) : da.levelInUnit(levelName(level), name),
    value: kr(numbers.amount),
    sub: shareSub(ctx, numbers.amount, { start: unit.start, end: unit.end }),
    trend: null,
  };

  const avg = numbers.average.amount;
  const ratio = change(numbers.amount, avg);
  const second: KeyCard =
    avg === null
      ? { label: da.vsAverage, value: da.none, sub: da.noDataBefore, trend: null }
      : {
          label: da.vsAverage,
          value: ratio === null ? da.none : signedPercent(ratio),
          sub: da.vsAverageSub(arrowed(numbers.amount - avg), kr(avg), g),
          trend: trendOf(numbers.amount - avg),
        };

  return [first, second, comparisonCard(unit, numbers.amount, numbers.before, numbers.beforeAmount, g)];
}

export function keyCards(ctx: ViewContext): [KeyCard, KeyCard, KeyCard] {
  return ctx.chosen === null ? periodCards(ctx) : unitCards(ctx, ctx.chosen);
}

/** null when the household has no subscriptions: then there are three key numbers (spec §1.4). */
export function subscriptionsCard(ctx: ViewContext): KeyCard | null {
  if (ctx.data.subscriptions.length === 0) return null;
  return {
    label: da.subscriptionsPerYear,
    value: kr(subscriptionsYear(ctx)),
    sub: da.subscriptionCount(shownSubscriptions(ctx).length),
    trend: null,
  };
}
