import { type ClassifiedPosting, total } from "@ha-spending/shared";

export interface ShopRow {
  name: string;
  /** The net sum in øre, refunds subtracted. */
  sum: number;
  /** Whole per cent of the whole base. */
  share: number;
}

export interface ShopList {
  visible: ShopRow[];
  hidden: ShopRow[];
  hiddenSum: number;
  /** The net of the base's postings with no shop. */
  noShop: number;
}

export type HiddenState = { kind: "loading" } | { kind: "ready"; shops: string[] } | { kind: "error" };

/** The length of a full bar: the biggest sum among the rows shown, shown hidden rows included. */
export function barScale(rows: ShopRow[]): number {
  return rows.reduce((max, r) => Math.max(max, r.sum), 0);
}

/** Shares are of the whole base, hidden shops and postings with no shop included, so hiding moves no share. */
export function shopList(base: ClassifiedPosting[], hidden: ReadonlySet<string>): ShopList {
  const sums = new Map<string, number>();
  let noShop = 0;
  for (const p of base) {
    if (p.shop === null) noShop += p.amount;
    else sums.set(p.shop, (sums.get(p.shop) ?? 0) + p.amount);
  }
  const whole = total(base);
  const rows = [...sums]
    .filter(([, sum]) => sum > 0)
    .map(([name, sum]) => ({ name, sum, share: whole > 0 ? Math.round((sum / whole) * 100) : 0 }))
    .sort((a, b) => b.sum - a.sum || a.name.localeCompare(b.name, "da"));
  const hiddenRows = rows.filter((r) => hidden.has(r.name));
  return {
    visible: rows.filter((r) => !hidden.has(r.name)),
    hidden: hiddenRows,
    hiddenSum: hiddenRows.reduce((sum, r) => sum + r.sum, 0),
    noShop,
  };
}
