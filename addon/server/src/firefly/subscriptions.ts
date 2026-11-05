import { addDays, compareKeys, gapMonths, MAX_GAP_MONTHS, type Posting, PAYMENTS_PER_YEAR, type Repeat,
  type Subscription } from "@ha-spending/shared";
import { toOre } from "./amount";
import { eachLimited, type FireflyClient, FireflyError, getAllPages } from "./client";
import { ASSET, type WireBill, type WireGroup, type WirePaidDate, type WireSplit } from "./wire";

export interface RawSubscription {
  bill: WireBill;
  objectGroup: string;
  lastPaid: WirePaidDate | null;
  split: WireSplit | null;
}

/** 24 months and a month: room for the last payment of the longest gap kept. */
const PAID_WINDOW_DAYS = 760;
const GROUP_READS_AT_ONCE = 5;

const day = (date: string) => date.slice(0, 10);

/** A bill with no object group, or a blank one, is not a subscription the page shows. */
function objectGroupOf(bill: WireBill): string | null {
  const title = bill.attributes.object_group_title;
  return typeof title === "string" && title.trim() !== "" ? title : null;
}

export function subscriptionLinks(bills: WireBill[]): (id: string | null) => Posting["subscription"] {
  const links = new Map<string, NonNullable<Posting["subscription"]>>();
  for (const bill of bills) {
    const objectGroup = objectGroupOf(bill);
    if (objectGroup !== null) links.set(bill.id, { id: bill.id, name: bill.attributes.name, objectGroup });
  }
  return (id) => (id === null ? null : (links.get(id) ?? null));
}

function latestPaid(bill: WireBill, today: string): WirePaidDate | null {
  let latest: WirePaidDate | null = null;
  for (const paid of bill.attributes.paid_dates ?? []) {
    if (day(paid.date) <= today && (latest === null || day(paid.date) > day(latest.date))) latest = paid;
  }
  return latest;
}

export async function readSubscriptions(
  client: FireflyClient,
  settings: { pageSize: number },
  today: string,
  signal?: AbortSignal,
): Promise<{ kept: RawSubscription[]; bills: WireBill[] }> {
  const query = { start: addDays(today, -PAID_WINDOW_DAYS), end: today };
  const bills = await getAllPages<WireBill>(client, "bills", query, settings.pageSize, signal);
  const grouped = bills.flatMap((bill) => {
    const objectGroup = objectGroupOf(bill);
    return objectGroup === null ? [] : [{ bill, objectGroup }];
  });
  const kept = await eachLimited(grouped, GROUP_READS_AT_ONCE, async ({ bill, objectGroup }) => {
    const lastPaid = latestPaid(bill, today);
    if (lastPaid === null) return { bill, objectGroup, lastPaid, split: null };
    const path = `transactions/${encodeURIComponent(lastPaid.transaction_group_id)}`;
    const group = (await client.get(path, {}, signal)) as { data?: WireGroup };
    const split = group.data?.attributes?.transactions?.find(
      (s) => s.transaction_journal_id === lastPaid.transaction_journal_id,
    );
    return { bill, objectGroup, lastPaid, split: split ?? null };
  });
  return { kept, bills };
}

const isRepeat = (value: string): value is Repeat => Object.hasOwn(PAYMENTS_PER_YEAR, value);

export function keepSubscriptions(
  raw: RawSubscription[],
  mainGroupOf: (category: string | null) => string | null,
  excluded: ReadonlySet<string>,
  today: string,
  rangeStart: string,
  warn: (message: string) => void,
): Subscription[] {
  const kept: Subscription[] = [];
  for (const { bill, objectGroup, lastPaid, split } of raw) {
    const a = bill.attributes;
    const end = a.end_date === null ? null : day(a.end_date);
    // An inactive bill does not run, so without an end date, or with one still ahead, the page cannot tell when it stopped.
    if (!a.active && (end === null || end > today)) continue;
    if (end !== null && end < today && end < rangeStart) continue;
    const repeat = a.repeat_freq;
    if (!isRepeat(repeat)) {
      warn(`The subscription ${bill.id} repeats in a way the page does not know; it is left out`);
      continue;
    }
    if (gapMonths(repeat, a.skip) > MAX_GAP_MONTHS) {
      warn(`The subscription ${bill.id} has more than ${MAX_GAP_MONTHS} months between payments; it is left out`);
      continue;
    }

    let lastPayment: Subscription["lastPayment"] = null;
    if (lastPaid !== null && day(lastPaid.date) <= today) {
      if (split === null) throw new FireflyError("unreachable");
      if (split.type !== "withdrawal" || split.source_type !== ASSET) continue;
      const mainGroup = mainGroupOf(split.category_name);
      if (mainGroup !== null && excluded.has(mainGroup)) continue;
      lastPayment = {
        date: day(lastPaid.date),
        amount: Math.abs(toOre(lastPaid.amount)),
        category: split.category_name,
        account: split.source_id,
      };
    }

    kept.push({
      id: bill.id,
      name: a.name,
      repeat,
      skip: a.skip,
      start: day(a.date),
      end,
      amountMin: toOre(a.amount_min),
      amountMax: toOre(a.amount_max),
      objectGroup,
      lastPayment,
    });
  }
  return kept.sort((x, y) => compareKeys(x.name, y.name));
}
