import { addDays, compareKeys, gapMonths, MAX_GAP_MONTHS, PAYMENTS_PER_YEAR, type Repeat,
  type Subscription } from "@ha-spending/shared";
import { toOre } from "./amount";
import { type FireflyClient, FireflyError, getAllPages } from "./client";
import { ASSET, type WireBill, type WireGroup, type WirePaidDate, type WireSplit } from "./wire";

export interface RawSubscription {
  bill: WireBill;
  lastPaid: WirePaidDate | null;
  split: WireSplit | null;
}

/** 24 months and a month: room for the last payment of the longest gap kept. */
const PAID_WINDOW_DAYS = 760;
const GROUP_READS_AT_ONCE = 5;

const day = (date: string) => date.slice(0, 10);

function latestPaid(bill: WireBill, today: string): WirePaidDate | null {
  let latest: WirePaidDate | null = null;
  for (const paid of bill.attributes.paid_dates ?? []) {
    if (day(paid.date) <= today && (latest === null || day(paid.date) > day(latest.date))) latest = paid;
  }
  return latest;
}

async function eachLimited<T, R>(items: T[], limit: number, read: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await read(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function readSubscriptions(
  client: FireflyClient,
  settings: { pageSize: number },
  today: string,
  signal?: AbortSignal,
): Promise<RawSubscription[]> {
  const query = { start: addDays(today, -PAID_WINDOW_DAYS), end: today };
  const bills = await getAllPages<WireBill>(client, "bills", query, settings.pageSize, signal);
  return eachLimited(bills, GROUP_READS_AT_ONCE, async (bill) => {
    const lastPaid = latestPaid(bill, today);
    if (lastPaid === null) return { bill, lastPaid, split: null };
    const path = `transactions/${encodeURIComponent(lastPaid.transaction_group_id)}`;
    const group = (await client.get(path, {}, signal)) as { data?: WireGroup };
    const split = group.data?.attributes?.transactions?.find(
      (s) => s.transaction_journal_id === lastPaid.transaction_journal_id,
    );
    return { bill, lastPaid, split: split ?? null };
  });
}

const isRepeat = (value: string): value is Repeat => Object.hasOwn(PAYMENTS_PER_YEAR, value);

export function keepSubscriptions(
  raw: RawSubscription[],
  mainGroupOf: (category: string | null) => string | null,
  excluded: ReadonlySet<string>,
  today: string,
  warn: (message: string) => void,
): Subscription[] {
  const kept: Subscription[] = [];
  for (const { bill, lastPaid, split } of raw) {
    const a = bill.attributes;
    if (!a.active) continue;
    const end = a.end_date === null ? null : day(a.end_date);
    if (end !== null && end < today) continue;
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
      lastPayment,
    });
  }
  return kept.sort((x, y) => compareKeys(x.name, y.name));
}
