import { type LeftOverData, localToday, type SpendingData } from "@ha-spending/shared";
import type { DataLoader, LeftOverLoader } from "./app";
import { createCache } from "./cache";
import type { FireflyClient } from "./firefly/client";
import { readLeftOverData } from "./firefly/left-over";
import { readSpanFree, readSpendingData, readTransactions, type ReadSettings, type SpanFree } from "./firefly/read";
import type { WireGroup } from "./firefly/wire";

/** Answers are kept per span, and the parts that do not depend on the span per day (D49). */
export function createDataLoader(
  client: FireflyClient,
  settings: ReadSettings,
  now: () => Date,
  warn: (message: string) => void,
): { loadData: DataLoader; loadLeftOver: LeftOverLoader } {
  const clock = () => now().getTime();
  const answers = createCache<SpendingData>({ ttlMs: 300_000, max: 20, now: clock });
  const leftOvers = createCache<LeftOverData>({ ttlMs: 300_000, max: 20, now: clock });
  const spanFrees = createCache<SpanFree>({ ttlMs: 300_000, max: 2, now: clock });
  // The raw groups of a span are large, so few are kept; both routes read a span through this one entry.
  const groupsCache = createCache<WireGroup[]>({ ttlMs: 300_000, max: 4, now: clock });

  const warned = new Set<string>();
  const warnOnce = (message: string) => {
    if (warned.has(message)) return;
    warned.add(message);
    warn(message);
  };

  const members = settings.members ?? [];
  const savings = settings.savingsCategories ?? [];
  const credit = settings.creditAccounts ?? [];
  let checked = false;
  const checkSetup = (kept: SpanFree) => {
    if (checked) return;
    checked = true;
    const names = (list: { attributes: { name: string } }[]) => new Set(list.map((a) => a.attributes.name));
    const revenue = names(kept.revenue);
    const categories = names(kept.categories);
    const assets = names(kept.accounts);
    const liabilities = names(kept.liabilities);
    for (const name of members) {
      if (!revenue.has(name)) warn(`The member "${name}" matches no revenue account in Firefly III`);
    }
    for (const name of savings) {
      if (!categories.has(name)) warn(`The savings category "${name}" matches no category in Firefly III`);
    }
    for (const name of credit) {
      if (assets.has(name)) continue;
      if (liabilities.has(name)) warn(`The credit account "${name}" is a liability, not an asset account`);
      else warn(`The credit account "${name}" matches no asset account in Firefly III`);
    }
  };

  const key = (today: string, range: { start: string; end: string }) => `${today}|${range.start}|${range.end}`;
  // Made under its own timeout and no route's signal, as the span-free parts are: one route's failure aborts no other.
  const contextFor = (today: string, range: { start: string; end: string }) => ({
    today,
    spanFree: () =>
      spanFrees.get(today, async () => {
        const kept = await readSpanFree(client, settings, today);
        checkSetup(kept);
        return kept;
      }),
    groups: () =>
      groupsCache.get(key(today, range), () =>
        readTransactions(client, settings, range, AbortSignal.timeout(settings.timeoutMs)),
      ),
  });

  return {
    loadData: (range) => {
      const today = localToday(now());
      return answers.get(key(today, range), () =>
        readSpendingData(client, settings, range, { ...contextFor(today, range), warn }),
      );
    },
    loadLeftOver: (range) => {
      const today = localToday(now());
      return leftOvers.get(key(today, range), () =>
        readLeftOverData(client, settings, range, { ...contextFor(today, range), warn: warnOnce }),
      );
    },
  };
}
