import type { Posting } from "@ha-spending/shared";
import { toOre } from "./amount";
import { ASSET, type WireGroup, type WireSplit } from "./wire";

function posting(groupId: string, split: WireSplit, kind: Posting["kind"], account: string): Posting {
  const amount = toOre(split.amount);
  return {
    id: split.transaction_journal_id,
    groupId,
    date: split.date.slice(0, 10),
    text: split.description,
    account,
    category: split.category_name,
    kind,
    amount: kind === "refund" ? -amount : amount,
  };
}

export function toPostings(
  groups: WireGroup[],
  mainGroupOf: (category: string | null) => string | null,
  excluded: ReadonlySet<string>,
): Posting[] {
  const postings: Posting[] = [];
  for (const group of groups) {
    for (const split of group.attributes.transactions) {
      const mainGroup = mainGroupOf(split.category_name);
      if (mainGroup !== null && excluded.has(mainGroup)) continue;
      if (split.type === "withdrawal" && split.source_type === ASSET) {
        postings.push(posting(group.id, split, "spending", split.source_id));
      } else if (split.type === "deposit" && split.destination_type === ASSET && split.category_name !== null) {
        postings.push(posting(group.id, split, "refund", split.destination_id));
      }
    }
  }
  return postings;
}
