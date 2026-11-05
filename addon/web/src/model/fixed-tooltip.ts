import { NO_PIECE } from "@ha-spending/shared";
import { escapeHtml } from "../format";
import { da } from "../i18n/da";
import { type FixedBar, type FixedPart, sumText } from "./fixed";

/** The folded line's swatch. */
export const GREY = NO_PIECE;

/** At most this many part lines, so a tooltip fits the chart (spec §4). */
const MAX_PARTS = 10;

export interface TooltipLine {
  text: string;
  /** The swatch; null for the unit line and the total. */
  colour: string | null;
  strong: boolean;
}

interface PartSums {
  part: FixedPart;
  paid: number;
  estimate: number;
  hasPaid: boolean;
  hasEstimate: boolean;
  due: boolean;
}

function sumsOf(rows: PartSums[]): string {
  const paid = rows.reduce((sum, r) => sum + r.paid, 0);
  const estimate = rows.reduce((sum, r) => sum + r.estimate, 0);
  return sumText(
    paid,
    estimate,
    rows.some((r) => r.hasPaid),
    rows.some((r) => r.hasEstimate),
  );
}

function lineWithDueMark(text: string, rows: PartSums[], colour: string): TooltipLine {
  return { text: rows.some((r) => r.due) ? text + da.fixed.dueMark : text, colour, strong: false };
}

/** The unit, a line per part in the parts' order, the rest folded past ten, then the total (spec §4). */
export function tooltipLines(bar: FixedBar, parts: FixedPart[]): TooltipLine[] {
  const unit: TooltipLine = { text: bar.name, colour: null, strong: false };
  if (bar.paid.size === 0 && bar.estimate.size === 0) {
    return [unit, { text: da.fixed.noPaymentsTip, colour: null, strong: false }];
  }
  const rows: PartSums[] = parts
    .filter((part) => bar.paid.has(part.key) || bar.estimate.has(part.key))
    .map((part) => ({
      part,
      paid: bar.paid.get(part.key) ?? 0,
      estimate: bar.estimate.get(part.key) ?? 0,
      hasPaid: bar.paid.has(part.key),
      hasEstimate: bar.estimate.has(part.key),
      due: bar.due.has(part.key),
    }));
  let kept = rows;
  let folded: PartSums[] = [];
  if (rows.length > MAX_PARTS) {
    // A stable sort, so parts of the same size keep the parts' order.
    const biggest = new Set(
      [...rows].sort((a, b) => Math.abs(b.paid + b.estimate) - Math.abs(a.paid + a.estimate)).slice(0, MAX_PARTS - 1),
    );
    kept = rows.filter((r) => biggest.has(r));
    folded = rows.filter((r) => !biggest.has(r));
  }
  const lines: TooltipLine[] = [
    unit,
    ...kept.map((r) => lineWithDueMark(da.fixed.partLine(r.part.name, sumsOf([r])), [r], r.part.colour)),
  ];
  if (folded.length > 0) lines.push(lineWithDueMark(da.fixed.others(folded.length, sumsOf(folded)), folded, GREY));
  lines.push({
    text: da.fixed.tooltipTotal(sumText(bar.paidSum, bar.estimateSum, bar.paid.size > 0, bar.estimate.size > 0)),
    colour: null,
    strong: true,
  });
  return lines;
}

export function tooltipHtml(lines: TooltipLine[]): string {
  return lines
    .map((line) => {
      const swatch =
        line.colour === null
          ? ""
          : `<span style="display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;background:${line.colour}"></span>`;
      const text = escapeHtml(line.text);
      return swatch + (line.strong ? `<strong>${text}</strong>` : text);
    })
    .join("<br>");
}
