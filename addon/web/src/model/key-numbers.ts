import { chosenUnitNumbers, keyNumbers, type Period, share, type Unit, within } from "@ha-spending/shared";
import { kr, percent, rangeText, unitName } from "../format";
import { da } from "../i18n/da";
import { levelName, type ViewContext } from "./context";

/** The line under a key number's value; `href` is the hash it opens, and the app handles the click itself. */
export type KeyLink = { kind: "postings"; count: number; href: string } | { kind: "subscriptions"; href: string };

export interface KeyCard {
  label: string;
  value: string;
  sub: string;
  link?: KeyLink;
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
  const name = unitName(unit, g);

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

const DAY = 24 * 60 * 60 * 1000;
const MONTH_DAYS = 365.25 / 12;

function days(period: Period): number {
  return (Date.parse(period.end) - Date.parse(period.start)) / DAY + 1;
}

/**
 * One card per object group that a kept bill has or a shown posting in the period is linked to; empty gives the
 * period's key numbers only (spec §4). The fetched range does not count. The set of groups is the period's; with a
 * chosen unit only the payments counted narrow to it. Each links to the Faste udgifter tab, which exists only when the
 * answer has bills.
 */
export function objectGroupCards(ctx: ViewContext, href: string): KeyCard[] {
  const period = ctx.timeline.period;
  const counted = ctx.chosen ?? period;
  const unit = ctx.chosen === null ? null : unitName(ctx.chosen, ctx.timeline.grouping);
  const linked = within(ctx.shown, counted).flatMap((p) =>
    p.subscription === null ? [] : [{ group: p.subscription.objectGroup, bill: p.subscription.name, amount: p.amount }],
  );
  const inPeriod = within(ctx.shown, period).flatMap((p) => (p.subscription === null ? [] : [p.subscription.objectGroup]));
  const names = new Set([...ctx.data.subscriptions.map((s) => s.objectGroup), ...inPeriod]);
  const length = days(period);
  const link: KeyLink | undefined = ctx.data.subscriptions.length === 0 ? undefined : { kind: "subscriptions", href };
  return [...names]
    .sort((a, b) => a.localeCompare(b, "da"))
    .map((name) => {
      const payments = linked.filter((l) => l.group === name);
      const bills = new Set(payments.map((l) => l.bill)).size;
      const sum = payments.reduce((acc, l) => acc + l.amount, 0);
      const sub =
        bills === 0
          ? da.noPayments
          : unit !== null || length < 28
            ? da.billCount(bills)
            : `${da.perMonth(kr(sum / (length / MONTH_DAYS)))} · ${da.billCount(bills)}`;
      return {
        label: unit === null ? da.inPeriod(name) : da.levelInUnit(name, unit),
        value: kr(sum),
        sub,
        link,
      };
    });
}
