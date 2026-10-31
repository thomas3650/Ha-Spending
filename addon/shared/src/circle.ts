import { compareKeys, type Part } from "./money";

export const PALETTE: readonly string[] = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
  "#6250d6",
  "#e34948",
];

const GREY_DARK = 0x8a;
const GREY_LIGHT = 0xc4;
/** The grey of a part with no piece in the circle. */
export const NO_PIECE = "#c4c4c4";

export interface CirclePart extends Part {
  colour: string;
  piece: boolean;
}

export function greys(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const level = n === 1 ? GREY_DARK : Math.round(GREY_DARK + ((GREY_LIGHT - GREY_DARK) * i) / (n - 1));
    const hex = level.toString(16).padStart(2, "0");
    return `#${hex}${hex}${hex}`;
  });
}

/** With `period`, each part keeps the colour its key has there, so a chosen unit's circle matches the period's (D16). */
export function circle(parts: Part[], period?: CirclePart[]): CirclePart[] {
  const ordered = [...parts].sort((a, b) => b.amount - a.amount || compareKeys(a.key, b.key));
  if (period) {
    const kept = new Map(period.filter((p) => p.piece).map((p) => [p.key, p.colour]));
    return ordered.map((p) => ({ ...p, colour: kept.get(p.key) ?? NO_PIECE, piece: p.amount > 0 }));
  }
  const positive = ordered.filter((p) => p.amount > 0).length;
  const colours = [...PALETTE.slice(0, positive), ...greys(Math.max(0, positive - PALETTE.length))];
  return ordered.map((p, i) =>
    p.amount > 0 ? { ...p, colour: colours[i], piece: true } : { ...p, colour: NO_PIECE, piece: false },
  );
}
