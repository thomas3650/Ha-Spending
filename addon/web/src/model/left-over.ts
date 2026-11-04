import type { LeftOverData, LeftOverMonth, Period } from "@ha-spending/shared";
import { plainCount } from "../format";
import { da } from "../i18n/da";

export type Column = "paidIn" | "back" | "spending" | "leftOver" | "credit" | "savings" | "other" | "change";
export type Tone = "plain" | "success" | "danger";

export interface Cell {
  text: string;
  tone: Tone;
  /** The muted line under Ind and Tilbage: "Anna 18.000 · Bo 13.000". */
  members?: string;
}

export interface Row {
  /** `YYYY-MM`; empty on "I alt". */
  month: string;
  name: string;
  /** Today's month; the view adds "(i gang)", which `name` leaves out. */
  running: boolean;
  cells: Record<Column, Cell>;
}

export interface LeftOverTable {
  columns: Column[];
  rows: Row[];
  total: Row;
}

const COLUMNS: readonly Column[] = ["paidIn", "back", "spending", "leftOver", "credit", "savings", "other", "change"];
const MINUS = "−";

/** Whole kroner, halves away from zero, as `kr()` rounds; never −0. */
export function roundKroner(ore: number): number {
  const kroner = Math.floor((Math.abs(ore) + 50) / 100);
  return ore < 0 && kroner !== 0 ? -kroner : kroner;
}

function negate(kroner: number): number {
  return kroner === 0 ? 0 : -kroner;
}

function signed(kroner: number): string {
  if (kroner === 0) return "0";
  return `${kroner > 0 ? "+" : MINUS}${plainCount(Math.abs(kroner))}`;
}

export function signedKroner(ore: number): string {
  return signed(roundKroner(ore));
}

/** A span's parts, each rounded once per month and signed by what it does to the daily accounts (spec §4.2). */
interface Parts {
  /** By member, without a sign. */
  paidIn: Map<string, number>;
  back: Map<string, number>;
  spending: number;
  credit: number;
  savings: number;
  other: number;
}

type Amounts = Record<Column, number>;

function partsOf(m: LeftOverMonth): Parts {
  return {
    paidIn: new Map(m.members.map((p) => [p.name, roundKroner(p.paidIn)])),
    back: new Map(m.members.map((p) => [p.name, roundKroner(p.back)])),
    spending: negate(roundKroner(m.spending)),
    credit: negate(roundKroner(m.credit)),
    savings: negate(roundKroner(m.savings)),
    other: roundKroner(m.other),
  };
}

function addMembers(a: Map<string, number>, b: Map<string, number>): Map<string, number> {
  const sum = new Map(a);
  for (const [name, kroner] of b) sum.set(name, (sum.get(name) ?? 0) + kroner);
  return sum;
}

function add(a: Parts, b: Parts): Parts {
  return {
    paidIn: addMembers(a.paidIn, b.paidIn),
    back: addMembers(a.back, b.back),
    spending: a.spending + b.spending,
    credit: a.credit + b.credit,
    savings: a.savings + b.savings,
    other: a.other + b.other,
  };
}

const NONE: Parts = { paidIn: new Map(), back: new Map(), spending: 0, credit: 0, savings: 0, other: 0 };

function sumOf(members: Map<string, number>): number {
  let sum = 0;
  for (const kroner of members.values()) sum += kroner;
  return sum;
}

/** Til overs and Ændring på konti come from the rounded parts, so the shown row adds up (spec §4.2's sum rule). */
function amountsOf(p: Parts): Amounts {
  const paidIn = sumOf(p.paidIn);
  const back = negate(sumOf(p.back));
  const leftOver = paidIn + back + p.spending;
  return {
    paidIn,
    back,
    spending: p.spending,
    leftOver,
    credit: p.credit,
    savings: p.savings,
    other: p.other,
    change: leftOver + p.credit + p.savings + p.other,
  };
}

function membersLine(members: Map<string, number>): string | undefined {
  const named = [...members]
    .filter(([, kroner]) => kroner !== 0)
    .sort(([a], [b]) => a.localeCompare(b, "da"))
    .map(([name, kroner]) => `${name} ${plainCount(kroner)}`);
  return named.length === 0 ? undefined : named.join(" · ");
}

function withMembers(cell: Cell, members: Map<string, number>): Cell {
  const line = membersLine(members);
  return line === undefined ? cell : { ...cell, members: line };
}

function creditText(kroner: number): string {
  if (kroner > 0) return `${signed(kroner)} ${da.leftOver.borrowed}`;
  if (kroner < 0) return `${signed(kroner)} ${da.leftOver.paidOff}`;
  return signed(kroner);
}

function cellsOf(p: Parts): Record<Column, Cell> {
  const a = amountsOf(p);
  const plain = (kroner: number): Cell => ({ text: signed(kroner), tone: "plain" });
  return {
    paidIn: withMembers(plain(a.paidIn), p.paidIn),
    back: withMembers(plain(a.back), p.back),
    spending: plain(a.spending),
    leftOver: { text: signed(a.leftOver), tone: a.leftOver > 0 ? "success" : a.leftOver < 0 ? "danger" : "plain" },
    credit: { text: creditText(a.credit), tone: a.credit > 0 ? "danger" : "plain" },
    savings: plain(a.savings),
    other: plain(a.other),
    change: { text: signed(a.change), tone: a.change < 0 ? "danger" : "plain" },
  };
}

function monthName(month: string, withYear: boolean): string {
  const [year, number] = month.split("-");
  const name = `${da.months[Number(number) - 1]}.`;
  return withYear ? `${name} ${year}` : name;
}

/** Newest month first, as the answer has them, closed by "I alt". */
export function leftOverTable(data: LeftOverData, today: string): LeftOverTable {
  const withYear = new Set(data.months.map((m) => m.month.slice(0, 4))).size > 1;
  const parts = data.months.map(partsOf);
  return {
    columns: COLUMNS.filter((c) => (c !== "credit" || data.hasCredit) && (c !== "savings" || data.hasSavings)),
    rows: data.months.map((m, i) => ({
      month: m.month,
      name: monthName(m.month, withYear),
      running: m.month === today.slice(0, 7),
      cells: cellsOf(parts[i]),
    })),
    total: { month: "", name: da.leftOver.total, running: false, cells: cellsOf(parts.reduce(add, NONE)) },
  };
}

/**
 * In øre, from the same rounded months as the table, so a span that cuts its first and last months still matches
 * "I alt". `borrowed` is the size of a net draw on the credit lines.
 */
export function leftOverCard(
  data: LeftOverData,
  span: Period,
): { leftOver: number; paidIn: number; borrowed: number | null } {
  const from = span.start.slice(0, 7);
  const to = span.end.slice(0, 7);
  const a = amountsOf(
    data.months
      .filter((m) => m.month >= from && m.month <= to)
      .map(partsOf)
      .reduce(add, NONE),
  );
  return { leftOver: a.leftOver * 100, paidIn: a.paidIn * 100, borrowed: a.credit > 0 ? a.credit * 100 : null };
}
