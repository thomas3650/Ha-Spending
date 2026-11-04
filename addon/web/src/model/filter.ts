import type { ClassifiedPosting, Posting } from "@ha-spending/shared";

const SUGGESTIONS = 8;

export interface ShopSuggestion {
  name: string;
  /** The net sum in øre, refunds subtracted. */
  sum: number;
}

export function fold(text: string): string {
  return text.trim().toLocaleLowerCase("da");
}

/** A chosen shop is matched by its exact name; the search is free text in the posting's text or its shop. */
export function matches(p: Posting, search: string, shop: string | null): boolean {
  if (shop !== null && p.shop !== shop) return false;
  const query = fold(search);
  return query === "" || fold(p.text).includes(query) || (p.shop !== null && fold(p.shop).includes(query));
}

/** A search that matched the bank's text but not the shop, so the row has to show why it is there. */
export function textOnlyHit(p: Posting, search: string): boolean {
  const query = fold(search);
  return query !== "" && p.shop !== null && !fold(p.shop).includes(query) && fold(p.text).includes(query);
}

export function shopSuggestions(base: Posting[], search: string): ShopSuggestion[] {
  const query = fold(search);
  if (query === "") return [];
  const sums = new Map<string, number>();
  for (const p of base) {
    if (p.shop !== null && fold(p.shop).includes(query)) sums.set(p.shop, (sums.get(p.shop) ?? 0) + p.amount);
  }
  const rank = (name: string) => (fold(name).startsWith(query) ? 0 : 1);
  return [...sums]
    .map(([name, sum]) => ({ name, sum }))
    .sort((a, b) => rank(a.name) - rank(b.name) || b.sum - a.sum || a.name.localeCompare(b.name, "da"))
    .slice(0, SUGGESTIONS);
}

/** Oldest first, and by id within a day, so the order is stable. */
export function byDate(a: ClassifiedPosting, b: ClassifiedPosting): number {
  return a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
}
