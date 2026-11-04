import { NO_PIECE, type Unit } from "@ha-spending/shared";
import { barKr, kr, shortDate, unitName } from "../format";
import { da } from "../i18n/da";
import type { FixedBar, FixedPayment, FixedView, Kind } from "./fixed";

export interface FixedRow {
  /** "1. aug"; null on a year row. */
  date: string | null;
  name: string;
  /** The name's tooltip: with several object groups in the normal card it names the row's group (spec §2.1). */
  nameTitle: string;
  objectGroup: string;
  /** The object-group badge after the name, in full screen only (spec §3.3). */
  badge: boolean;
  colour: string;
  category: string;
  /** "9.500 kr.", "ca. 9.500 kr." or "–". */
  amount: string;
  /** Drawn in italics. */
  estimate: boolean;
  /** null on a year row, which says it in `sub`. */
  status: { kind: Kind; due: boolean; text: string } | null;
  /** A year row's line under the name. */
  sub: string | null;
}

export interface FixedListOptions {
  /** The list fills the page. */
  full: boolean;
  /** The step names one object group, so a row need not name it. */
  oneGroup: boolean;
}

export interface FixedGroup {
  name: string;
  count: string;
  sum: string;
  rows: FixedRow[];
}

export interface FixedList {
  title: string;
  summary: string;
  showCategory: boolean;
  /** A year unit's rows are one per fixed expense, with no date and no status (spec §6.3). */
  perBill: boolean;
  /** Newest first; null with a chosen unit, which has no group line. */
  groups: FixedGroup[] | null;
  /** Every row, in the order shown. */
  rows: FixedRow[];
  /** null when there are rows. */
  empty: string | null;
  full: boolean;
}

function sumOf(payments: FixedPayment[]): number {
  return payments.reduce((sum, p) => sum + p.amount, 0);
}

function counted(payments: FixedPayment[]): FixedPayment[] {
  return payments.filter((p) => p.kind !== "notSeen");
}

function statusText(p: FixedPayment): string {
  switch (p.kind) {
    case "paid":
      return da.fixed.status.paid;
    case "notSeen":
      return da.fixed.status.notSeen;
    case "estimate":
      return p.due ? da.fixed.status.due : da.fixed.status.expected;
  }
}

function amountText(p: FixedPayment): string {
  switch (p.kind) {
    case "paid":
      return barKr(p.amount);
    case "notSeen":
      return da.none;
    case "estimate":
      return da.fixed.estimated(kr(p.amount));
  }
}

type Colours = Map<string | null, string>;

/** Without the badge, a row of a list with several object groups names its group elsewhere (spec §2.1). */
function namesGroup(opts: FixedListOptions): boolean {
  return !opts.oneGroup && !opts.full;
}

function paymentRows(payments: FixedPayment[], view: FixedView, colours: Colours, opts: FixedListOptions): FixedRow[] {
  return payments.map((p) => {
    const date = shortDate(p.date, view.today);
    return {
      date,
      name: p.name,
      nameTitle: namesGroup(opts) ? da.fixed.nameInGroup(p.name, p.objectGroup) : p.name,
      objectGroup: p.objectGroup,
      badge: opts.full,
      colour: colours.get(p.part) ?? NO_PIECE,
      category: p.category ?? da.noCategory,
      amount: amountText(p),
      estimate: p.kind === "estimate",
      status: { kind: p.kind, due: p.due, text: statusText(p) },
      sub: null,
    };
  });
}

/** A year holds too many payments for a row each, so it has one row per fixed expense, biggest first (spec §6.3). */
function yearRows(payments: FixedPayment[], view: FixedView, colours: Colours, opts: FixedListOptions): FixedRow[] {
  const byBill = new Map<string, FixedPayment[]>();
  for (const p of payments) {
    const key = JSON.stringify([p.objectGroup, p.name]);
    byBill.set(key, [...(byBill.get(key) ?? []), p]);
  }
  return [...byBill.values()]
    .map((ps) => {
      const estimates = ps.filter((p) => p.kind === "estimate");
      const count = counted(ps).length;
      const notSeen = ps.length - count;
      const sum = sumOf(ps);
      const latest = ps[ps.length - 1];
      const lines: string[] = namesGroup(opts) ? [latest.objectGroup] : [];
      if (count > 0) lines.push(da.fixed.payments(count));
      if (estimates.length > 0) {
        lines.push(da.fixed.ofWhichEstimates(estimates.length, shortDate(estimates[0].date, view.today)));
      }
      if (notSeen > 0) lines.push(da.fixed.notSeenCount(notSeen));
      const row: FixedRow = {
        date: null,
        name: latest.name,
        nameTitle: namesGroup(opts) ? da.fixed.nameInGroup(latest.name, latest.objectGroup) : latest.name,
        objectGroup: latest.objectGroup,
        badge: opts.full,
        colour: colours.get(latest.part) ?? NO_PIECE,
        category: latest.category ?? da.noCategory,
        amount: count === 0 ? da.none : estimates.length > 0 ? da.fixed.estimated(kr(sum)) : barKr(sum),
        estimate: estimates.length > 0,
        status: null,
        sub: lines.join(" · "),
      };
      return { sum, row };
    })
    .sort((a, b) => b.sum - a.sum || a.row.name.localeCompare(b.row.name, "da"))
    .map((r) => r.row);
}

function groupCount(bar: FixedBar, payments: FixedPayment[]): string {
  const paying = counted(payments);
  const parts = [da.fixed.payments(paying.length)];
  if (paying.length > 0 && paying.every((p) => p.kind === "estimate")) parts.push(da.fixed.allEstimates);
  if (bar.running) parts.push(da.inProgress);
  return parts.join(" · ");
}

function summary(payments: FixedPayment[]): string {
  const paid = sumOf(payments.filter((p) => p.kind === "paid"));
  const estimates = payments.filter((p) => p.kind === "estimate");
  const parts = [da.fixed.payments(counted(payments).length), da.fixed.summaryPaid(barKr(paid))];
  if (estimates.length > 0) {
    const estimate = sumOf(estimates);
    parts.push(da.fixed.summaryEstimate(kr(estimate)), da.fixed.summaryTotal(kr(paid + estimate)));
  }
  return parts.join(" · ");
}

/** The payments beside the bars: grouped by unit without a chosen unit, else that unit's rows only (spec §6). */
export function fixedList(
  view: FixedView,
  chosen: Unit | null,
  opts: FixedListOptions = { full: false, oneGroup: true },
): FixedList {
  const colours: Colours = new Map(view.parts.map((p) => [p.key, p.colour]));
  const toRows = view.grouping === "year" ? yearRows : paymentRows;
  const bars = chosen === null ? view.bars : view.bars.filter((b) => b.unit.fullStart === chosen.fullStart);
  const groups = bars
    .map((bar) => ({ bar, payments: view.payments.filter((p) => p.date >= bar.unit.start && p.date <= bar.unit.end) }))
    .filter((g) => g.payments.length > 0)
    .reverse()
    .map(({ bar, payments }) => ({
      payments,
      group: { name: bar.name, count: groupCount(bar, payments), sum: bar.sum, rows: toRows(payments, view, colours, opts) },
    }));
  const payments = groups.flatMap((g) => g.payments);
  return {
    title: chosen === null ? da.fixed.inPeriod : unitName(chosen, view.grouping, view.unitYear),
    summary: summary(payments),
    showCategory: view.showCategory,
    perBill: view.grouping === "year",
    groups: chosen === null ? groups.map((g) => g.group) : null,
    rows: groups.flatMap((g) => g.group.rows),
    empty: payments.length === 0 ? view.empty : null,
    full: opts.full,
  };
}
