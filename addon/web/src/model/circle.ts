import {
  circle,
  type CirclePart,
  type ClassifiedPosting,
  NO_PIECE,
  parts,
  share,
  total,
  unitTotals,
  within,
} from "@ha-spending/shared";
import { type BarItem, isRunning } from "../components/bars";
import type { CircleItem } from "../components/circle";
import { unitAxis, unitName } from "../format";
import { partName, type ViewContext } from "./context";

function periodCircle(ctx: ViewContext): CirclePart[] {
  return circle(parts(within(ctx.circlePostings, ctx.timeline.period), ctx.circleLevel));
}

/** The chosen unit's circle keeps the period's colours (D16). */
function shownCircle(ctx: ViewContext): CirclePart[] {
  if (ctx.chosen === null) return periodCircle(ctx);
  return circle(parts(within(ctx.circlePostings, ctx.chosen), ctx.circleLevel), periodCircle(ctx));
}

/** The circle's postings in the chosen unit, or in the period. */
export function circleSpan(ctx: ViewContext): ClassifiedPosting[] {
  return within(ctx.circlePostings, ctx.chosen ?? ctx.timeline.period);
}

export function circleTotal(ctx: ViewContext): number {
  return total(circleSpan(ctx));
}

export function circleItems(ctx: ViewContext): CircleItem[] {
  const of = ctx.circleLevel.kind === "all" ? "mainGroup" : "category";
  const whole = circleTotal(ctx);
  return shownCircle(ctx).map((p) => ({
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

/**
 * Uden kategori is in every main group, so it keeps its circle colour only while one main group is shown (UI spec
 * §3.2).
 */
export function categoryColours(ctx: ViewContext): Map<string | null, string> {
  const inPeriod = within(ctx.postings, ctx.timeline.period);
  const colours = new Map<string | null, string>();
  for (const mainGroup of new Set(inPeriod.map((p) => p.mainGroup))) {
    for (const p of circle(parts(inPeriod, { kind: "mainGroup", mainGroup }))) {
      if (p.key !== null) colours.set(p.key, p.colour);
    }
  }
  const level = ctx.state.level;
  const shown = level.kind === "all" ? undefined : partColours(ctx).get(null);
  colours.set(null, shown ?? NO_PIECE);
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
