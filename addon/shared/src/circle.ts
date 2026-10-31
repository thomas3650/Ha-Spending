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
const NO_PIECE = "#c4c4c4";

export interface CirclePart extends Part {
  colour: string;
  piece: boolean;
}

/** From the darkest grey for the largest to the lightest for the smallest. */
export function greys(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const level = n === 1 ? GREY_DARK : Math.round(GREY_DARK + ((GREY_LIGHT - GREY_DARK) * i) / (n - 1));
    const hex = level.toString(16).padStart(2, "0");
    return `#${hex}${hex}${hex}`;
  });
}

export function circle(parts: Part[]): CirclePart[] {
  const ordered = [...parts].sort((a, b) => b.amount - a.amount || compareKeys(a.key, b.key));
  const positive = ordered.filter((p) => p.amount > 0).length;
  const colours = [...PALETTE.slice(0, positive), ...greys(Math.max(0, positive - PALETTE.length))];
  return ordered.map((p, i) =>
    p.amount > 0 ? { ...p, colour: colours[i], piece: true } : { ...p, colour: NO_PIECE, piece: false },
  );
}
