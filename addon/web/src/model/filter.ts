import { type ClassifiedPosting, within } from "@ha-spending/shared";
import type { AmountRange, Sort } from "../state/view";
import type { ViewContext } from "./context";

export function matchesSearch(text: string, q: string): boolean {
  const query = q.trim().toLocaleLowerCase("da");
  return query === "" || text.toLocaleLowerCase("da").includes(query);
}

export function inAmount(p: ClassifiedPosting, range: AmountRange | null): boolean {
  if (range === null) return true;
  if (range.min !== null && p.amount < range.min * 100) return false;
  return range.max === null || p.amount <= range.max * 100;
}

function byDate(a: ClassifiedPosting, b: ClassifiedPosting): number {
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

export function filteredPostings(ctx: ViewContext): ClassifiedPosting[] {
  const { search, amount } = ctx.state;
  return within(ctx.shown, ctx.chosen ?? ctx.timeline.period).filter(
    (p) => matchesSearch(p.text, search) && inAmount(p, amount),
  );
}
