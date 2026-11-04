import {
  circle,
  type CirclePart,
  type ClassifiedPosting,
  isRunning,
  type Level,
  NO_PIECE,
  parts,
  select,
  share,
  total,
  unitTotals,
  within,
} from "@ha-spending/shared";
import type { BarItem } from "../components/bars";
import type { CircleItem } from "../components/circle";
import { unitAxis, unitName } from "../format";
import { finerUnits, partName, type ViewContext } from "./context";

function periodCircle(ctx: ViewContext, postings = ctx.circlePostings, level = ctx.circleLevel): CirclePart[] {
  return circle(parts(within(postings, ctx.timeline.period), level));
}

/** The chosen unit's circle keeps the period's colours (D16). */
function shownCircle(ctx: ViewContext, postings = ctx.circlePostings, level = ctx.circleLevel): CirclePart[] {
  if (ctx.chosen === null) return periodCircle(ctx, postings, level);
  return circle(parts(within(postings, ctx.chosen), level), periodCircle(ctx, postings, level));
}

export interface LevelRow {
  key: string | null;
  name: string;
  colour: string;
  sum: number;
  current: boolean;
}

/**
 * The circle's pieces at a level, as the trail's list shows them, plus the chosen one when it has no piece, so the
 * list always says where the page is. The category list needs a chosen main group.
 */
export function levelRows(ctx: ViewContext, of: "mainGroup" | "category"): LevelRow[] {
  const chosen = ctx.state.level;
  if (of === "category" && chosen.kind === "all") return [];
  const level: Level =
    chosen.kind === "all" || of === "mainGroup" ? { kind: "all" } : { kind: "mainGroup", mainGroup: chosen.mainGroup };
  const current = chosenKey(chosen, of);
  const rows = shownCircle(ctx, select(ctx.postings, level, null), level)
    .filter((p) => p.piece || p.key === current)
    .map((p) => ({ key: p.key, name: partName(p.key, of), colour: p.colour, sum: p.amount, current: p.key === current }));
  if (current !== undefined && !rows.some((r) => r.current)) {
    rows.push({ key: current, name: partName(current, of), colour: NO_PIECE, sum: 0, current: true });
  }
  return rows;
}

/** undefined when nothing is chosen at that level: null is Uden hovedgruppe or Uden kategori. */
function chosenKey(level: Level, of: "mainGroup" | "category"): string | null | undefined {
  if (of === "mainGroup") return level.kind === "all" ? undefined : level.mainGroup;
  return level.kind === "category" ? level.category : undefined;
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
  const finer = finerUnits(ctx);
  const g = finer?.grouping ?? ctx.timeline.grouping;
  const units = finer?.units ?? ctx.units;
  const totals = unitTotals(ctx.shown, units);
  return units.map((unit, i) => ({
    unit,
    axis: unitAxis(unit, g),
    name: unitName(unit, g),
    amount: totals[i],
    running: isRunning(unit, ctx.today),
    choose: finer === null ? unit.fullStart : null,
  }));
}
