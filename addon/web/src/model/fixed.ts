import {
  amountPerPayment,
  compareKeys,
  dueDatesUntil,
  greys,
  type Grouping,
  groupingFor,
  isRunning,
  type Level,
  NO_PIECE,
  paidPerMonth,
  PALETTE,
  type Period,
  type SpendingData,
  type Unit,
  unitAt,
  unitsOf,
  within,
} from "@ha-spending/shared";
import type { UnitStep } from "../components/unit-menu";
import { barKr, kr, rangeText, shortDate, unitName, withYear } from "../format";
import { da } from "../i18n/da";
import { type PeriodChoice, periodOf, type ViewState } from "../state/view";
import { chosenKey, type LevelRow, partColours } from "./circle";
import { levelName, partName, type ViewContext, viewContext } from "./context";
import { type KeyCard, objectGroupNames } from "./key-numbers";
import { shown, tabRows } from "./subscriptions";

export interface FixedUnits {
  /** The period's grouping, as on the overview. */
  grouping: Grouping;
  /** The drawn span. */
  span: Period;
  units: Unit[];
  buttons: boolean;
  /** The units are the span's days: the span is one month. */
  days: boolean;
}

/** The presets that run on past today and so hold estimates (spec §5.1). */
const RUNS_ON: ReadonlySet<PeriodChoice["preset"]> = new Set(["thisYear", "thisMonth", "all"]);

function spanEnd(preset: PeriodChoice["preset"], period: Period, grouping: Grouping, today: string): string {
  switch (preset) {
    case "thisYear":
      return unitAt(period.start, "year", today).fullEnd;
    case "thisMonth":
      return unitAt(period.start, "month", today).fullEnd;
    case "all":
      return unitAt(today, grouping, today).fullEnd;
    default:
      return period.end;
  }
}

/** Without a context, so that `normalise`, and the trail before the answer, can resolve the view's units. */
export function fixedUnits(
  data: Pick<SpendingData, "earliestPostingDate">,
  state: ViewState,
  today: string,
): FixedUnits {
  const period = periodOf(state.period, today, data.earliestPostingDate);
  const grouping = groupingFor(period);
  const span = { start: period.start, end: spanEnd(state.period.preset, period, grouping, today) };
  const units = unitsOf(span, grouping, today);
  const days = grouping === "month" && units.length === 1;
  return {
    grouping,
    span,
    units: days ? unitsOf(span, "day", today) : units,
    buttons: !days && units.length > 1,
    days,
  };
}

/**
 * The time the Alle faste udgifter tab lists, and the object groups count by: the chosen unit, or the view's span.
 * The overview counts by it too, so its cards and the view give one number (spec §3.2, §5).
 */
export function tabTime(data: Pick<SpendingData, "earliestPostingDate">, state: ViewState, today: string): Period {
  const f = fixedUnits(data, state, today);
  const unit = f.buttons ? f.units.find((u) => u.fullStart === state.unit) : undefined;
  return unit === undefined ? f.span : { start: unit.start, end: unit.end };
}

export type Kind = "paid" | "estimate" | "notSeen";

export interface FixedPayment {
  date: string;
  /** The bill's name. */
  name: string;
  objectGroup: string;
  /** A known category, or null. */
  category: string | null;
  /** The part of the bars it is stacked in. */
  part: string | null;
  kind: Kind;
  /** Øre; 0 for not seen. */
  amount: number;
  /** A Forfalden estimate: its date is before today. */
  due: boolean;
}

export interface FixedBar {
  unit: Unit;
  name: string;
  paid: Map<string | null, number>;
  /** Every estimate, a due one included. */
  estimate: Map<string | null, number>;
  /** The due estimates, also in `estimate` (spec §5.3). */
  due: Map<string | null, number>;
  paidSum: number;
  estimateSum: number;
  /** The bar button's name (spec §5.4). */
  label: string;
  /** The sum as the unit step and the list's group line write it. */
  sum: string;
  running: boolean;
}

export interface ObjectGroupRow {
  /** null is Alle. */
  name: string | null;
  count: number;
  sum: number;
  current: boolean;
}

export interface FixedPart {
  key: string | null;
  name: string;
  colour: string;
}

export interface FixedView {
  units: Unit[];
  /** The units' grouping: "day" when they are the span's days. */
  grouping: Grouping;
  buttons: boolean;
  unitYear: boolean;
  /** The chosen unit, resolved against the view's units. */
  chosen: Unit | null;
  /** The answer's today, which the row dates are written against. */
  today: string;
  /** By date. */
  payments: FixedPayment[];
  /** Largest first. */
  parts: FixedPart[];
  bars: FixedBar[];
  cards: KeyCard[];
  groups: ObjectGroupRow[];
  unitStep: UnitStep | null;
  showCategory: boolean;
  /** The list's text when it has no rows. */
  empty: string;
}

/** What the bars stack by: the tree's next level below the chosen one (spec §5.2). */
type Of = "mainGroup" | "category" | "bill";

function stackOf(level: Level): Of {
  switch (level.kind) {
    case "all":
      return "mainGroup";
    case "mainGroup":
      return "category";
    case "category":
      return "bill";
  }
}

function partKey(of: Of, category: string | null, mainGroup: string | null, bill: string): string | null {
  switch (of) {
    case "mainGroup":
      return mainGroup;
    case "category":
      return category;
    case "bill":
      return bill;
  }
}

function inGroup(state: ViewState, group: string): boolean {
  return state.objectGroup === null || state.objectGroup === group;
}

function sumOf(payments: FixedPayment[]): number {
  return payments.reduce((sum, p) => sum + p.amount, 0);
}

function fixedPayments(ctx: ViewContext, f: FixedUnits, of: Of): FixedPayment[] {
  const state = ctx.state;
  const today = ctx.data.today;
  const payments: FixedPayment[] = within(ctx.shown, ctx.timeline.period).flatMap((p) =>
    p.subscription === null || !inGroup(state, p.subscription.objectGroup)
      ? []
      : [
          {
            date: p.date,
            name: p.subscription.name,
            objectGroup: p.subscription.objectGroup,
            category: p.category,
            part: partKey(of, p.category, p.mainGroup, p.subscription.name),
            kind: "paid",
            amount: p.amount,
            due: false,
          },
        ],
  );
  const runsOn = RUNS_ON.has(state.period.preset);
  const mainGroups = new Map(ctx.data.categories.map((c) => [c.name, c.mainGroup]));
  for (const { subscription: s, next, status } of shown(ctx)) {
    if (!inGroup(state, s.objectGroup)) continue;
    const last = s.lastPayment?.category ?? null;
    const category = last !== null && mainGroups.has(last) ? last : null;
    const mainGroup = category === null ? null : (mainGroups.get(category) ?? null);
    const base = { name: s.name, objectGroup: s.objectGroup, category, part: partKey(of, category, mainGroup, s.name) };
    const notSeen = status.kind === "notSeen" ? next : null;
    const dates = runsOn ? dueDatesUntil(s, today, f.span.end) : notSeen === null ? [] : [notSeen];
    for (const date of dates) {
      if (date < f.span.start || date > f.span.end) continue;
      if (date === notSeen) {
        payments.push({ ...base, date, kind: "notSeen", amount: 0, due: false });
      } else if (date === next || date >= today) {
        // Only the first date can be before today: the later misses of a bill not seen show nowhere.
        payments.push({ ...base, date, kind: "estimate", amount: amountPerPayment(s), due: date < today });
      }
    }
  }
  return payments.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, "da"));
}

/**
 * A part keeps its circle colour at that level; a part that is grey there or has no piece, and every fixed expense in
 * a category, takes the first palette colour no other part uses, largest first, then greys (spec §5.2).
 */
export function fixedColours(
  ctx: ViewContext,
  parts: { key: string | null; size: number }[],
): Map<string | null, string> {
  const ordered = [...parts].sort((a, b) => b.size - a.size || compareKeys(a.key, b.key));
  const circle = ctx.state.level.kind === "category" ? new Map<string | null, string>() : partColours(ctx);
  const colours = new Map<string | null, string>();
  for (const p of ordered) {
    const colour = circle.get(p.key);
    if (colour !== undefined && PALETTE.includes(colour)) colours.set(p.key, colour);
  }
  const used = new Set(colours.values());
  const rest = ordered.filter((p) => !colours.has(p.key));
  const free = PALETTE.filter((c) => !used.has(c));
  const fill = [...free, ...greys(Math.max(0, rest.length - free.length))];
  rest.forEach((p, i) => colours.set(p.key, fill[i]));
  return new Map(ordered.map((p) => [p.key, colours.get(p.key) ?? NO_PIECE]));
}

function fixedParts(ctx: ViewContext, payments: FixedPayment[], of: Of): FixedPart[] {
  const sizes = new Map<string | null, number>();
  for (const p of payments) sizes.set(p.part, (sizes.get(p.part) ?? 0) + p.amount);
  const colours = fixedColours(
    ctx,
    [...sizes].map(([key, size]) => ({ key, size })),
  );
  return [...colours].map(([key, colour]) => ({ key, name: of === "bill" ? (key ?? "") : partName(key, of), colour }));
}

/** §6.1's sum: "9.799 kr. + ca. 1.074 kr." when mixed. */
export function sumText(paid: number, estimate: number, hasPaid: boolean, hasEstimate: boolean): string {
  if (!hasEstimate) return barKr(paid);
  return hasPaid ? da.fixed.sum(barKr(paid), kr(estimate)) : da.fixed.estimated(kr(estimate));
}

function barLabel(name: string, paid: number, estimate: number, hasPaid: boolean, hasEstimate: boolean): string {
  if (hasPaid && hasEstimate) return da.fixed.barMixed(name, barKr(paid), kr(estimate));
  if (hasPaid) return da.fixed.barPaid(name, barKr(paid));
  if (hasEstimate) return da.fixed.barEstimate(name, kr(estimate));
  return da.fixed.barNone(name);
}

function addTo(sums: Map<string | null, number>, p: FixedPayment): void {
  sums.set(p.part, (sums.get(p.part) ?? 0) + p.amount);
}

function fixedBars(
  ctx: ViewContext,
  units: Unit[],
  g: Grouping,
  unitYear: boolean,
  payments: FixedPayment[],
): FixedBar[] {
  return units.map((unit) => {
    const paid = new Map<string | null, number>();
    const estimate = new Map<string | null, number>();
    const due = new Map<string | null, number>();
    let hasPaid = false;
    let hasEstimate = false;
    for (const p of payments) {
      if (p.date < unit.start || p.date > unit.end) continue;
      if (p.kind === "paid") {
        hasPaid = true;
        addTo(paid, p);
      } else if (p.kind === "estimate") {
        hasEstimate = true;
        addTo(estimate, p);
        if (p.due) addTo(due, p);
      }
    }
    const paidSum = [...paid.values()].reduce((a, b) => a + b, 0);
    const estimateSum = [...estimate.values()].reduce((a, b) => a + b, 0);
    const name = unitName(unit, g, unitYear);
    return {
      unit,
      name,
      paid,
      estimate,
      due,
      paidSum,
      estimateSum,
      label: barLabel(name, paidSum, estimateSum, hasPaid, hasEstimate),
      sum: sumText(paidSum, estimateSum, hasPaid, hasEstimate),
      running: isRunning(unit, ctx.today),
    };
  });
}

/** The cards follow the period, not a chosen unit (spec §4). */
function fixedCards(ctx: ViewContext, f: FixedUnits, unitYear: boolean, payments: FixedPayment[]): KeyCard[] {
  const period = ctx.timeline.period;
  const today = ctx.data.today;
  const paidPayments = payments.filter((p) => p.kind === "paid");
  const estimates = payments.filter((p) => p.kind === "estimate");
  const paid = sumOf(paidPayments);
  const estimate = sumOf(estimates);
  const notSeen = payments.filter((p) => p.kind === "notSeen").length;
  const dated = notSeen === 0 ? rangeText(period) : `${rangeText(period)} · ${da.fixed.notSeenCount(notSeen)}`;
  const end = shortDate(f.span.end, today);
  const whole = (name: string, paidPart: number, estimateParts: FixedPayment[]): KeyCard => {
    const estimatePart = sumOf(estimateParts);
    return {
      label: da.fixed.estimateFor(name),
      value: kr(paidPart + estimatePart),
      sub: da.fixed.paidPlus(kr(estimatePart), end),
      estimate: estimateParts.length > 0,
    };
  };

  switch (ctx.state.period.preset) {
    case "thisYear": {
      const year = period.start.slice(0, 4);
      const average = paidPerMonth(paidPayments, ctx.timeline);
      const split = da.fixed.yearSplit(year);
      return [
        { label: da.fixed.paidThisYear, value: kr(paid), sub: dated },
        {
          label: da.fixed.remaining,
          value: kr(estimate),
          sub: da.fixed.paymentsUntil(da.fixed.payments(estimates.length), end),
          estimate: true,
        },
        whole(year, paid, estimates),
        {
          label: da.fixed.perMonthEstimate,
          value: kr((paid + estimate) / 12),
          sub: average === null ? split : [split, da.fixed.summaryPaid(da.perMonth(kr(average.amount)))].join(" · "),
          estimate: estimates.length > 0,
        },
      ];
    }
    case "thisMonth": {
      const month = unitName(unitAt(period.start, "month", ctx.today), "month", false).toLowerCase();
      const next = estimates.at(0);
      return [
        { label: da.fixed.paidIn(month), value: kr(paid), sub: dated },
        whole(month, paid, estimates),
        next === undefined
          ? { label: da.fixed.nextPayment, value: da.none, sub: da.fixed.noMoreIn(month) }
          : {
              label: da.fixed.nextPayment,
              value: kr(next.amount),
              sub: da.fixed.nextOn(shortDate(next.date, today), next.name),
              estimate: true,
            },
      ];
    }
    case "all": {
      const running = unitAt(ctx.today, f.grouping, ctx.today);
      const name = unitName(running, f.grouping, unitYear).toLowerCase();
      const start = running.fullStart < period.start ? period.start : running.fullStart;
      const inRunning = (p: FixedPayment) => p.date >= start;
      return [
        { label: da.fixed.paidTotal, value: kr(paid), sub: dated },
        {
          label: da.fixed.paidIn(name),
          value: kr(sumOf(paidPayments.filter(inRunning))),
          sub: rangeText({ start, end: period.end }),
        },
        whole(name, sumOf(paidPayments.filter(inRunning)), estimates.filter(inRunning)),
      ];
    }
    default: {
      const first: KeyCard = { label: da.fixed.paidInPeriod, value: kr(paid), sub: dated };
      const average = paidPerMonth(paidPayments, ctx.timeline);
      if (average === null) return [first];
      return [
        first,
        { label: da.fixed.averagePerMonth, value: kr(average.amount), sub: da.fixed.payments(average.count) },
      ];
    }
  }
}

/** §3.4's rows: the overview's object groups by name, then Alle; each counts the tab's rows and sums the period's paid. */
function objectGroupRows(ctx: ViewContext): ObjectGroupRow[] {
  const linked = within(ctx.shown, ctx.timeline.period);
  const row = (name: string | null): ObjectGroupRow => {
    const of = (group: string) => name === null || group === name;
    return {
      name,
      count: tabRows({ ...ctx, state: { ...ctx.state, objectGroup: name } }).length,
      sum: linked.reduce(
        (sum, p) => (p.subscription !== null && of(p.subscription.objectGroup) ? sum + p.amount : sum),
        0,
      ),
      current: ctx.state.objectGroup === name,
    };
  };
  const names = objectGroupNames(ctx).sort((a, b) => a.localeCompare(b, "da"));
  return [...names.map(row), row(null)];
}

export interface ObjectGroupStep {
  /** The step's text. */
  title: string;
  /** One object group: nothing to switch to, so the step is its title alone (spec §3.4). */
  single: boolean;
}

/** `rows` are §3.4's rows, Alle last; null while the answer loads, when only the state names the group. */
export function objectGroupStep(rows: ObjectGroupRow[] | null, chosen: string | null): ObjectGroupStep {
  const single = rows !== null && rows.length === 2;
  return { title: (single ? rows[0].name : chosen) ?? da.allFixed, single };
}

/** Resolves the chosen unit against the view's units, not the overview's (spec §5.1). */
export function fixedView(ctx: ViewContext): FixedView {
  const f = fixedUnits(ctx.data, ctx.state, ctx.today);
  const g: Grouping = f.days ? "day" : f.grouping;
  const unitYear = withYear(f.units);
  const of = stackOf(ctx.state.level);
  const payments = fixedPayments(ctx, f, of);
  const bars = fixedBars(ctx, f.units, g, unitYear, payments);
  const chosen = f.buttons ? (f.units.find((u) => u.fullStart === ctx.state.unit) ?? null) : null;
  const unitStep: UnitStep | null = f.buttons
    ? {
        word: f.grouping === "year" ? "year" : "month",
        rows: bars.map((b) => ({
          fullStart: b.unit.fullStart,
          name: b.name,
          sum: b.sum,
          current: b.unit.fullStart === chosen?.fullStart,
        })),
        chosen: chosen === null ? null : unitName(chosen, g, unitYear),
      }
    : null;
  return {
    units: f.units,
    grouping: g,
    buttons: f.buttons,
    unitYear,
    chosen,
    today: ctx.data.today,
    payments,
    parts: fixedParts(ctx, payments, of),
    bars,
    cards: fixedCards(ctx, f, unitYear, payments),
    groups: objectGroupRows(ctx),
    unitStep,
    showCategory: ctx.state.level.kind !== "category",
    empty: da.fixed.empty(levelName(ctx.state.level)),
  };
}

/**
 * The trail's main-group or category list in the view: the parts one level up from the chosen one, with their paid
 * and estimated fixed expenses in the tab's time, plus the chosen one when it has none (enhancement follow-ups spec
 * §3.1). The colours are the bars' at that level, sized over the whole span.
 */
export function fixedLevelRows(ctx: ViewContext, of: "mainGroup" | "category"): LevelRow[] {
  const chosen = ctx.state.level;
  if (of === "category" && chosen.kind === "all") return [];
  const level: Level =
    chosen.kind === "all" || of === "mainGroup" ? { kind: "all" } : { kind: "mainGroup", mainGroup: chosen.mainGroup };
  const view = fixedView(viewContext(ctx.data, { ...ctx.state, level }, ctx.today));
  const time = tabTime(ctx.data, ctx.state, ctx.today);
  const sums = new Map<string | null, { paid: number; estimate: number; hasPaid: boolean; hasEstimate: boolean }>();
  for (const p of view.payments) {
    if (p.kind === "notSeen" || p.date < time.start || p.date > time.end) continue;
    const sum = sums.get(p.part) ?? { paid: 0, estimate: 0, hasPaid: false, hasEstimate: false };
    if (p.kind === "paid") {
      sum.paid += p.amount;
      sum.hasPaid = true;
    } else {
      sum.estimate += p.amount;
      sum.hasEstimate = true;
    }
    sums.set(p.part, sum);
  }
  const current = chosenKey(chosen, of);
  if (current !== undefined && !sums.has(current)) {
    sums.set(current, { paid: 0, estimate: 0, hasPaid: false, hasEstimate: false });
  }
  const colours = new Map(view.parts.map((p) => [p.key, p.colour]));
  return [...sums]
    .map(([key, s]) => ({
      key,
      name: partName(key, of),
      colour: colours.get(key) ?? NO_PIECE,
      sum: s.paid + s.estimate,
      sumText: sumText(s.paid, s.estimate, s.hasPaid, s.hasEstimate),
      current: key === current,
    }))
    .sort((a, b) => b.sum - a.sum || a.name.localeCompare(b.name, "da"));
}
