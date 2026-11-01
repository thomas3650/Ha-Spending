import { isoWeek, type Grouping, type Period, type Unit } from "@ha-spending/shared";
import { da } from "./i18n/da";
import type { AmountRange } from "./state/view";

const whole = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });
const cents = new Intl.NumberFormat("da-DK", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const oneDecimal = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 1 });
const percentFormat = new Intl.NumberFormat("da-DK", {
  style: "percent",
  maximumFractionDigits: 0,
});
const tableDateFormat = new Intl.DateTimeFormat("da-DK", {
  timeZone: "UTC",
  day: "numeric",
  month: "numeric",
  year: "numeric",
});
const longMonth = new Intl.DateTimeFormat("da-DK", {
  timeZone: "UTC",
  month: "long",
});

function parts(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

function utc(date: string): Date {
  const { year, month, day } = parts(date);
  return new Date(Date.UTC(year, month - 1, day));
}

function upperFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function monthName(date: string): string {
  return longMonth.format(utc(date));
}

function quarterOf(date: string): number {
  return Math.ceil(parts(date).month / 3);
}

function isZero(text: string): boolean {
  return !/[1-9]/.test(text);
}

export function kr(ore: number): string {
  return `${whole.format(Math.abs(ore) / 100)} ${da.kr}`;
}

export function signedKr(ore: number): string {
  const text = whole.format(Math.abs(ore) / 100);
  if (isZero(text)) return `${text} ${da.kr}`;
  return `${ore < 0 ? "-" : "+"}${text} ${da.kr}`;
}

/** The range is in whole kroner, not øre. */
export function amountChip(range: AmountRange): string {
  const text = (kroner: number | null) => (kroner === null ? null : whole.format(kroner));
  return da.amountChip(text(range.min), text(range.max));
}

export function postingAmount(ore: number): string {
  const text = cents.format(Math.abs(ore) / 100);
  if (ore > 0) return `-${text}`;
  if (ore < 0) return `+${text}`;
  return text;
}

export function percent(fraction: number): string {
  return percentFormat.format(Math.abs(fraction));
}

export function signedPercent(fraction: number): string {
  const text = percentFormat.format(Math.abs(fraction));
  if (isZero(text)) return text;
  return `${fraction < 0 ? "-" : "+"}${text}`;
}

export function axisKr(ore: number): string {
  const amount = ore / 100;
  return Math.abs(amount) >= 1000 ? `${oneDecimal.format(amount / 1000)}k` : whole.format(amount);
}

export function tableDate(date: string): string {
  return tableDateFormat.format(utc(date));
}

export function rangeText(period: Period): string {
  const start = parts(period.start);
  const end = parts(period.end);
  const endText = `${end.day}. ${da.months[end.month - 1]} ${end.year}`;
  if (period.start === period.end) return endText;
  if (start.year !== end.year) return `${start.day}. ${da.months[start.month - 1]} ${start.year} – ${endText}`;
  if (start.month === end.month) return `${start.day}. – ${endText}`;
  return `${start.day}. ${da.months[start.month - 1]} – ${endText}`;
}

export function unitName(unit: Unit, g: Grouping): string {
  const date = unit.fullStart;
  const { year } = parts(date);
  switch (g) {
    case "day":
      return tableDate(date);
    case "week": {
      const iso = isoWeek(date);
      return `${da.groupings.week.label} ${iso.week} ${iso.year}`;
    }
    case "month":
      return `${upperFirst(monthName(date))} ${year}`;
    case "quarter":
      return `${quarterOf(date)}. ${da.groupings.quarter.one} ${year}`;
    case "year":
      return String(year);
  }
}

export function unitAxis(unit: Unit, g: Grouping): string {
  const date = unit.fullStart;
  const { year, month, day } = parts(date);
  switch (g) {
    case "day":
      return `${day}.${month}.`;
    case "week":
      return `${da.groupings.week.one} ${isoWeek(date).week}`;
    case "month":
      return da.months[month - 1];
    case "quarter":
      return da.quarterAxis(quarterOf(date));
    case "year":
      return String(year);
  }
}

export function comparisonLabel(unit: Unit, before: Unit, g: Grouping): string {
  const a = unit.fullStart;
  const b = before.fullStart;
  const sameYear = parts(a).year === parts(b).year;
  switch (g) {
    case "day":
      return sameYear
        ? `${unitAxis(unit, g)} ${da.against} ${unitAxis(before, g)}`
        : `${tableDate(a)} ${da.against} ${tableDate(b)}`;
    case "week": {
      const ia = isoWeek(a);
      const ib = isoWeek(b);
      const years = ia.year !== ib.year;
      return `${da.groupings.week.label} ${ia.week}${years ? ` ${ia.year}` : ""} ${da.against} ${da.groupings.week.one} ${ib.week}${years ? ` ${ib.year}` : ""}`;
    }
    case "month":
      return `${upperFirst(monthName(a))}${sameYear ? "" : ` ${parts(a).year}`} ${da.against} ${monthName(b)}${sameYear ? "" : ` ${parts(b).year}`}`;
    case "quarter": {
      const one = da.groupings.quarter.one;
      return `${quarterOf(a)}. ${one}${sameYear ? "" : ` ${parts(a).year}`} ${da.against} ${quarterOf(b)}. ${one}${sameYear ? "" : ` ${parts(b).year}`}`;
    }
    case "year":
      return `${parts(a).year} ${da.against} ${parts(b).year}`;
  }
}

export function partLabel(name: string, amount: number, share: number | null): string {
  const base = `${name}, ${kr(amount)}`;
  return share === null ? base : `${base}, ${percent(share)}`;
}

export function count(n: number): string {
  return `${whole.format(n)} ${n === 1 ? da.postingOne : da.postingMany}`;
}

/** "1. nov", with the year when it is not today's year. */
export function shortDate(date: string, today: string): string {
  const { year, month, day } = parts(date);
  const text = `${day}. ${da.months[month - 1]}`;
  return year === parts(today).year ? text : `${text} ${year}`;
}

/** Both whole, or both with øre, so a rise of a few øre never reads as two equal amounts. */
export function stepAmounts(max: number, paid: number): [string, string] {
  const format = max % 100 === 0 && paid % 100 === 0 ? whole : cents;
  return [format.format(max / 100), format.format(paid / 100)];
}
