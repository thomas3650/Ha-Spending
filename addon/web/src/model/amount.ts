/** The quick filter's amount, in øre (top-filter spec §4.2). */
export type AmountFilter =
  | { kind: "about" | "under" | "over"; value: number }
  | { kind: "between"; min: number; max: number };

export type AmountKind = AmountFilter["kind"];

const whole = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });
const cents = new Intl.NumberFormat("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Omkring's ends: ±20 %, each rounded to 50 kr. from 250 kr. up and to whole kroner below. Scaled by 4/5 and 6/5,
 * not 0.8 and 1.2, which binary floating point holds inexactly, so an end that falls on a tie is not nudged below it.
 */
export function aboutBounds(value: number): { min: number; max: number } {
  const step = value >= 25_000 ? 5_000 : 100;
  return {
    min: Math.round((value * 4) / (5 * step)) * step,
    max: Math.round((value * 6) / (5 * step)) * step,
  };
}

/** The signed amount, so a refund is under any bound. */
export function inAmount(p: { amount: number }, amount: AmountFilter | null): boolean {
  if (amount === null) return true;
  switch (amount.kind) {
    case "under":
      return p.amount < amount.value;
    case "over":
      return p.amount > amount.value;
    case "between":
      return p.amount >= amount.min && p.amount <= amount.max;
    case "about": {
      const { min, max } = aboutBounds(amount.value);
      return p.amount >= min && p.amount <= max;
    }
  }
}

/**
 * Øre as D47's typed form, which `parseDanishAmount` reads back. Here and not in format.ts, because the texts in
 * da.ts word an amount with it, and format.ts imports da.ts.
 */
export function amountText(ore: number): string {
  return ore % 100 === 0 ? whole.format(ore / 100) : cents.format(ore / 100);
}

export function sameAmount(a: AmountFilter | null, b: AmountFilter | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind === "between") return b.kind === "between" && a.min === b.min && a.max === b.max;
  return b.kind !== "between" && a.kind === b.kind && a.value === b.value;
}
