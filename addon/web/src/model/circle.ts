import { circle, type CirclePart, parts, share, total, unitTotals, within } from "@ha-spending/shared";
import { type BarItem, isRunning } from "../components/bars";
import type { CircleItem } from "../components/circle";
import { unitAxis, unitName } from "../format";
import { partName, type ViewContext } from "./context";

const NO_CATEGORY = "#c4c4c4";

function periodCircle(ctx: ViewContext): CirclePart[] {
  return circle(parts(within(ctx.circlePostings, ctx.timeline.period), ctx.circleLevel));
}

export function circleTotal(ctx: ViewContext): number {
  return total(within(ctx.circlePostings, ctx.timeline.period));
}

export function circleItems(ctx: ViewContext): CircleItem[] {
  const of = ctx.circleLevel.kind === "all" ? "mainGroup" : "category";
  const whole = circleTotal(ctx);
  return periodCircle(ctx).map((p) => ({
    key: p.key,
    name: partName(p.key, of),
    amount: p.amount,
    share: share(p.amount, whole),
    colour: p.colour,
    piece: p.piece,
  }));
}

export function partColours(ctx: ViewContext): Map<string | null, string> {
  return new Map(periodCircle(ctx).map((p) => [p.key, p.colour]));
}

export function categoryColours(ctx: ViewContext): Map<string | null, string> {
  const inPeriod = within(ctx.postings, ctx.timeline.period);
  const colours = new Map<string | null, string>();
  for (const mainGroup of new Set(inPeriod.map((p) => p.mainGroup))) {
    for (const p of circle(parts(inPeriod, { kind: "mainGroup", mainGroup }))) colours.set(p.key, p.colour);
  }
  colours.set(null, NO_CATEGORY);
  return colours;
}

export function barItems(ctx: ViewContext): BarItem[] {
  const g = ctx.timeline.grouping;
  const totals = unitTotals(ctx.shown, ctx.units);
  return ctx.units.map((unit, i) => ({
    unit,
    axis: unitAxis(unit, g),
    name: unitName(unit, g),
    amount: totals[i],
    running: isRunning(unit, ctx.today),
  }));
}
