import { change, keyNumbers, share } from "@ha-spending/shared";
import { comparisonLabel, kr, percent, rangeText, signedPercent, unitName } from "../format";
import { da } from "../i18n/da";
import { levelName, type ViewContext } from "./context";

export interface KeyCard {
  label: string;
  value: string;
  sub: string;
  trend: "up" | "down" | null;
}

function shareSub(ctx: ViewContext, amount: number): string {
  if (ctx.parentLevel === null) return rangeText(ctx.timeline.period);
  const fraction = ctx.parentTotal === null ? null : share(amount, ctx.parentTotal);
  if (fraction === null) return da.none;
  return ctx.parentLevel.kind === "all"
    ? da.shareOfAll(percent(fraction))
    : da.shareOf(percent(fraction), levelName(ctx.parentLevel));
}

/** The period's form; the chosen unit's form comes with the Forskel card. */
export function keyCards(ctx: ViewContext): [KeyCard, KeyCard, KeyCard] {
  const g = ctx.timeline.grouping;
  const numbers = keyNumbers(ctx.shown, ctx.timeline);
  const level = ctx.state.level;

  const first: KeyCard = {
    label: level.kind === "all" ? da.spendingInPeriod : da.inPeriod(levelName(level)),
    value: kr(numbers.total),
    sub: shareSub(ctx, numbers.total),
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
  let third: KeyCard = { label: da.none, value: da.none, sub: "", trend: null };
  if (c) {
    const label = comparisonLabel(c.unit, c.before, g);
    if (c.beforeAmount === null) {
      third = { label, value: da.none, sub: da.noData(unitName(c.before, g)), trend: null };
    } else {
      const diff = c.amount - c.beforeAmount;
      const ratio = change(c.amount, c.beforeAmount);
      third = {
        label,
        value: ratio === null ? da.none : signedPercent(ratio),
        sub: diff > 0 ? `${da.up} ${kr(diff)}` : diff < 0 ? `${da.down} ${kr(diff)}` : kr(0),
        trend: diff > 0 ? "up" : diff < 0 ? "down" : null,
      };
    }
  }
  return [first, second, third];
}
