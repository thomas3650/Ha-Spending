import { addMonths, compareKeys, type LeftOverData, type LeftOverMember, type LeftOverMonth,
  type Period } from "@ha-spending/shared";
import { toOre } from "./amount";
import type { FireflyClient } from "./client";
import { spendingKind } from "./normalise";
import { mainGroupLookup, type ReadSettings, readSpan, type SpanContext } from "./read";
import { ASSET, EXPENSE, REVENUE, type WireGroup, type WireSplit } from "./wire";

export interface LeftOverRules {
  members: ReadonlySet<string>;
  savingsCategories: ReadonlySet<string>;
  creditAccounts: ReadonlySet<string>;
  mainGroupOf: (category: string | null) => string | null;
  excluded: ReadonlySet<string>;
  warn: (message: string) => void;
}

/** An opening balance or a reconciliation is no money in or out (the Til overs spec §3.2). */
const READ_TYPES = new Set(["withdrawal", "deposit", "transfer"]);

const MISSORTED =
  "A member's money or a savings posting counts as spending, as its category is missing or not in an excluded " +
  "main group";

type Bucket = { kind: "paidIn" | "back"; member: string } | { kind: "savings" | "other" };

/** Buckets 2 to 5 of the Til overs spec §3.2, the first that takes the split. */
function bucketAfterSpending(split: WireSplit, rules: LeftOverRules): Bucket {
  if (split.type === "deposit" && split.source_type === REVENUE && rules.members.has(split.source_name)) {
    return { kind: "paidIn", member: split.source_name };
  }
  if (split.type === "withdrawal" && split.destination_type === EXPENSE && rules.members.has(split.destination_name)) {
    return { kind: "back", member: split.destination_name };
  }
  const savings = split.category_name !== null && rules.savingsCategories.has(split.category_name);
  if ((split.type === "withdrawal" || split.type === "deposit") && savings) return { kind: "savings" };
  return { kind: "other" };
}

/** Every calendar month the range touches, newest first. */
function monthsOf(range: Period): string[] {
  const months: string[] = [];
  const first = range.start.slice(0, 7);
  for (let day = `${range.end.slice(0, 7)}-01`; day.slice(0, 7) >= first; day = addMonths(day, -1)) {
    months.push(day.slice(0, 7));
  }
  return months;
}

interface Tally {
  month: LeftOverMonth;
  members: Map<string, LeftOverMember>;
}

function memberOf(tally: Tally, name: string): LeftOverMember {
  let member = tally.members.get(name);
  if (member === undefined) {
    member = { name, paidIn: 0, back: 0 };
    tally.members.set(name, member);
  }
  return member;
}

export function leftOverMonths(groups: WireGroup[], range: Period, rules: LeftOverRules): LeftOverMonth[] {
  const tallies = new Map<string, Tally>(monthsOf(range).map((month) => [month, {
    month: { month, paidIn: 0, back: 0, members: [], spending: 0, savings: 0, credit: 0, other: 0, change: 0 },
    members: new Map(),
  }]));
  let missorted = false;

  for (const split of groups.flatMap((g) => g.attributes.transactions)) {
    const date = split.date.slice(0, 10);
    if (!READ_TYPES.has(split.type) || date < range.start || date > range.end) continue;
    const tally = tallies.get(date.slice(0, 7))!;
    const { month } = tally;
    const amount = toOre(split.amount);

    const sides = [
      { name: split.source_name, type: split.source_type, onto: -amount },
      { name: split.destination_name, type: split.destination_type, onto: amount },
    ].filter((side) => side.type === ASSET);
    for (const side of sides) {
      if (rules.creditAccounts.has(side.name)) month.credit += side.onto;
      else month.change += side.onto;
    }
    // A split between two household accounts only moves money between them; one with no side on them is not the
    // household's money.
    if (sides.length !== 1) continue;

    const onto = sides[0].onto;
    const bucket = bucketAfterSpending(split, rules);
    if (spendingKind(split, rules.mainGroupOf, rules.excluded) !== null) {
      month.spending -= onto;
      if (bucket.kind !== "other") missorted = true;
    } else if (bucket.kind === "paidIn") {
      memberOf(tally, bucket.member).paidIn += onto;
      month.paidIn += onto;
    } else if (bucket.kind === "back") {
      memberOf(tally, bucket.member).back -= onto;
      month.back -= onto;
    } else if (bucket.kind === "savings") {
      month.savings -= onto;
    } else {
      month.other += onto;
    }
  }

  if (missorted) rules.warn(MISSORTED);
  return [...tallies.values()].map(({ month, members }) => ({
    ...month,
    members: [...members.values()]
      .filter((m) => m.paidIn !== 0 || m.back !== 0)
      .sort((a, b) => compareKeys(a.name, b.name)),
  }));
}

export async function readLeftOverData(
  client: FireflyClient,
  settings: ReadSettings,
  range: Period,
  context: SpanContext & { warn: (message: string) => void },
): Promise<LeftOverData> {
  const { groups, spanFree } = await readSpan(client, settings, range, context);
  const savingsCategories = new Set(settings.savingsCategories ?? []);
  const creditAccounts = new Set(settings.creditAccounts ?? []);
  const months = leftOverMonths(groups, range, {
    members: new Set(settings.members ?? []),
    savingsCategories,
    creditAccounts,
    mainGroupOf: mainGroupLookup(spanFree.mainGroups),
    excluded: new Set(settings.excludedMainGroups),
    warn: context.warn,
  });
  return {
    range,
    today: context.today,
    hasSavings: spanFree.categories.some((c) => savingsCategories.has(c.attributes.name)),
    hasCredit: spanFree.accounts.some((a) => creditAccounts.has(a.attributes.name)),
    months,
  };
}
