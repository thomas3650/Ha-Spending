import type { Posting } from "@ha-spending/shared";
import { toOre } from "./amount";
import { ASSET, EXPENSE, NO_SHOP, REVENUE, type WireGroup, type WireSplit } from "./wire";

function shopName(name: string, type: string, wanted: string): string | null {
  if (type !== wanted || name.toLocaleLowerCase("und") === NO_SHOP) return null;
  return name;
}

function posting(
  groupId: string,
  split: WireSplit,
  kind: Posting["kind"],
  account: string,
  shop: string | null,
  linkOf: (id: string | null) => Posting["subscription"],
): Posting {
  const amount = toOre(split.amount);
  return {
    id: split.transaction_journal_id,
    groupId,
    date: split.date.slice(0, 10),
    text: split.description,
    account,
    category: split.category_name,
    kind,
    shop,
    amount: kind === "refund" ? -amount : amount,
    subscription: linkOf(split.bill_id),
  };
}

/** Whether the overview counts the split as spending or a refund (D12, D15); null when it leaves it out. */
export function spendingKind(
  split: WireSplit,
  mainGroupOf: (category: string | null) => string | null,
  excluded: ReadonlySet<string>,
): Posting["kind"] | null {
  const mainGroup = mainGroupOf(split.category_name);
  if (mainGroup !== null && excluded.has(mainGroup)) return null;
  if (split.type === "withdrawal" && split.source_type === ASSET) return "spending";
  if (split.type === "deposit" && split.destination_type === ASSET && split.category_name !== null) return "refund";
  return null;
}

export function toPostings(
  groups: WireGroup[],
  mainGroupOf: (category: string | null) => string | null,
  excluded: ReadonlySet<string>,
  linkOf: (id: string | null) => Posting["subscription"],
): Posting[] {
  const postings: Posting[] = [];
  for (const group of groups) {
    for (const split of group.attributes.transactions) {
      const kind = spendingKind(split, mainGroupOf, excluded);
      if (kind === "spending") {
        postings.push(posting(group.id, split, kind, split.source_id,
          shopName(split.destination_name, split.destination_type, EXPENSE), linkOf));
      } else if (kind === "refund") {
        postings.push(posting(group.id, split, kind, split.destination_id,
          shopName(split.source_name, split.source_type, REVENUE), linkOf));
      }
    }
  }
  return postings;
}
