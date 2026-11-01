import { type ClassifiedPosting, type Posting, within } from "@ha-spending/shared";
import type { AmountRange, Sort } from "../state/view";
import type { ViewContext } from "./context";

const SUGGESTIONS = 8;

export interface ShopSuggestion {
  name: string;
  /** The net sum in øre, refunds subtracted. */
  sum: number;
}

function fold(text: string): string {
  return text.trim().toLocaleLowerCase("da");
}

/** A chosen shop is matched by its exact name; the search is free text in the posting's text or its shop. */
export function matches(p: Posting, search: string, shop: string | null): boolean {
  if (shop !== null && p.shop !== shop) return false;
  const query = fold(search);
  return query === "" || fold(p.text).includes(query) || (p.shop !== null && fold(p.shop).includes(query));
}

export function shopSuggestions(base: Posting[], search: string): ShopSuggestion[] {
  const query = fold(search);
  if (query === "") return [];
  const sums = new Map<string, number>();
  for (const p of base) {
    if (p.shop !== null && fold(p.shop).includes(query)) sums.set(p.shop, (sums.get(p.shop) ?? 0) + p.amount);
  }
  return [...sums]
    .map(([name, sum]) => ({ name, sum }))
    .sort((a, b) => b.sum - a.sum || a.name.localeCompare(b.name, "da"))
    .slice(0, SUGGESTIONS);
}

export function inAmount(p: ClassifiedPosting, range: AmountRange | null): boolean {
  if (range === null) return true;
  if (range.min !== null && p.amount < range.min * 100) return false;
  return range.max === null || p.amount <= range.max * 100;
}

/** Oldest first, and by id within a day, so the order is stable. */
export function byDate(a: ClassifiedPosting, b: ClassifiedPosting): number {
  return a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
}

export function sortPostings(ps: ClassifiedPosting[], sort: Sort): ClassifiedPosting[] {
  const sorted = [...ps];
  switch (sort) {
    case "newest":
      return sorted.sort((a, b) => byDate(b, a));
    case "oldest":
      return sorted.sort(byDate);
    case "largest":
      return sorted.sort((a, b) => b.amount - a.amount || byDate(b, a));
    case "smallest":
      return sorted.sort((a, b) => a.amount - b.amount || byDate(b, a));
  }
}

/** Alle posteringer's postings before the search and the chosen shop. */
export function searchBase(ctx: ViewContext): ClassifiedPosting[] {
  return within(ctx.shown, ctx.chosen ?? ctx.timeline.period).filter((p) => inAmount(p, ctx.state.amount));
}

export function filteredPostings(ctx: ViewContext): ClassifiedPosting[] {
  const { search, shop } = ctx.state;
  return searchBase(ctx).filter((p) => matches(p, search, shop));
}
