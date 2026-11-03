import { type Account, type Category, compareKeys, type Period, type SpendingData } from "@ha-spending/shared";
import { type FireflyClient, FireflyError, getAllPages } from "./client";
import { findRuleGroup, mapCategories } from "./main-groups";
import { toPostings } from "./normalise";
import { keepSubscriptions, readSubscriptions, subscriptionLinks } from "./subscriptions";
import { ASSET, type WireAbout, type WireAccount, type WireCategory, type WireGroup, type WirePage, type WireRule,
  type WireRuleGroup } from "./wire";

export interface ReadSettings {
  mainGroupRuleGroup: string;
  excludedMainGroups: string[];
  fireflyLinkUrl: string | null;
  pageSize: number;
  timeoutMs: number;
}

/** The add-on's timeout for one read (technical spec §3.3). */
export const READ_TIMEOUT_MS = 30_000;

/**
 * Firefly III has no endpoint for it: the last page of one transaction per page holds the oldest. Only withdrawals and
 * deposits count: an opening balance, a reconciliation or a transfer is not spending (D12).
 */
export async function earliestPostingDate(
  client: FireflyClient,
  today: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const oldest = async (type: string) => {
    const query = { start: "1900-01-01", end: today, type, limit: "1" };
    const page = async (n: number) =>
      (await client.get("transactions", { ...query, page: String(n) }, signal)) as WirePage<WireGroup>;
    let answer = await page(1);
    const pages = answer.meta?.pagination?.total_pages ?? 0;
    if (pages === 0) return null;
    if (pages > 1) answer = await page(pages);
    const split = answer.data?.[0]?.attributes.transactions[0];
    return split ? split.date.slice(0, 10) : null;
  };
  const dates = (await Promise.all([oldest("withdrawal"), oldest("deposit")])).filter((d) => d !== null);
  return dates.length === 0 ? null : dates.reduce((a, b) => (a < b ? a : b));
}

export async function readMainGroups(
  client: FireflyClient,
  settings: Pick<ReadSettings, "mainGroupRuleGroup" | "pageSize">,
  signal: AbortSignal,
) {
  const groups = await getAllPages<WireRuleGroup>(client, "rule-groups", {}, settings.pageSize, signal);
  const group = findRuleGroup(groups, settings.mainGroupRuleGroup);
  if (group === null) return { found: false, ...mapCategories([]) };
  const path = `rule-groups/${encodeURIComponent(group.id)}/rules`;
  const rules = await getAllPages<WireRule>(client, path, {}, settings.pageSize, signal);
  return { found: true, ...mapCategories(rules) };
}

function assetNames(groups: WireGroup[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const split of groups.flatMap((g) => g.attributes.transactions)) {
    if (split.source_type === ASSET) names.set(split.source_id, split.source_name);
    if (split.destination_type === ASSET) names.set(split.destination_id, split.destination_name);
  }
  return names;
}

export interface SpanFree {
  accounts: WireAccount[];
  categories: WireCategory[];
  mainGroups: Awaited<ReturnType<typeof readMainGroups>>;
  earliest: string | null;
  subscriptions: Awaited<ReturnType<typeof readSubscriptions>>;
}

/** One failed request stops the others under the same signal, so they do not run on until the timeout. */
function firstFailure(timeoutMs: number, outer?: AbortSignal) {
  const failed = new AbortController();
  const signals = [AbortSignal.timeout(timeoutMs), failed.signal, ...(outer ? [outer] : [])];
  return {
    signal: AbortSignal.any(signals),
    stopOnFailure: <T>(promise: Promise<T>) =>
      promise.catch((error: unknown) => {
        failed.abort();
        throw error;
      }),
  };
}

/**
 * The parts of an answer that do not depend on its span (D49). Shared between spans, they are read without `outer`, so
 * no span's request aborts them.
 */
export async function readSpanFree(
  client: FireflyClient,
  settings: ReadSettings,
  today: string,
  outer?: AbortSignal,
): Promise<SpanFree> {
  const { signal, stopOnFailure } = firstFailure(settings.timeoutMs, outer);
  const all = <T>(path: string, query: Record<string, string> = {}) =>
    getAllPages<T>(client, path, query, settings.pageSize, signal);
  const [accounts, categories, mainGroups, earliest, subscriptions] = await Promise.all([
    stopOnFailure(all<WireAccount>("accounts", { type: "asset" })),
    stopOnFailure(all<WireCategory>("categories")),
    stopOnFailure(readMainGroups(client, settings, signal)),
    stopOnFailure(earliestPostingDate(client, today, signal)),
    stopOnFailure(readSubscriptions(client, settings, today, signal)),
  ]);
  return { accounts, categories, mainGroups, earliest, subscriptions };
}

export async function readSpendingData(
  client: FireflyClient,
  settings: ReadSettings,
  range: Period,
  context: { today: string; warn: (message: string) => void; spanFree?: () => Promise<SpanFree> },
): Promise<SpendingData> {
  const { signal, stopOnFailure } = firstFailure(settings.timeoutMs);
  const spanFree = context.spanFree ?? (() => readSpanFree(client, settings, context.today, signal));
  const [groups, kept] = await Promise.all([
    stopOnFailure(
      getAllPages<WireGroup>(client, "transactions", { start: range.start, end: range.end, type: "all" },
        settings.pageSize, signal),
    ),
    stopOnFailure(spanFree()),
  ]);
  const { accounts: listed, categories: wireCategories, mainGroups, earliest, subscriptions: rawSubscriptions } = kept;

  for (const category of mainGroups.conflicts) {
    context.warn(`The main group rules map the category "${category}" to more than one main group; the last rule wins`);
  }

  const mainGroupOf = (category: string | null) =>
    category === null ? null : (mainGroups.mapping.get(category) ?? null);
  const excluded = new Set(settings.excludedMainGroups);
  const postings = toPostings(groups, mainGroupOf, excluded, subscriptionLinks(rawSubscriptions.bills));
  const subscriptions = keepSubscriptions(rawSubscriptions.kept, mainGroupOf, excluded, context.today, context.warn);

  const accounts = new Map<string, Account>(listed.map((a) => [a.id, { id: a.id, name: a.attributes.name }]));
  const names = assetNames(groups);
  for (const { account } of postings) {
    if (!accounts.has(account)) accounts.set(account, { id: account, name: names.get(account) ?? account });
  }

  const categories: Category[] = wireCategories
    .map((c) => ({ name: c.attributes.name, mainGroup: mainGroupOf(c.attributes.name) }))
    .filter((c) => c.mainGroup === null || !excluded.has(c.mainGroup))
    .sort((a, b) => compareKeys(a.name, b.name));
  const groupNames = new Set(categories.flatMap((c) => (c.mainGroup === null ? [] : [c.mainGroup])));

  return {
    range,
    today: context.today,
    earliestPostingDate: earliest,
    postings,
    accounts: [...accounts.values()].sort((a, b) => compareKeys(a.name, b.name)),
    categories,
    mainGroups: [...groupNames].sort(compareKeys),
    mainGroupsFound: mainGroups.found,
    fireflyLinkUrl: settings.fireflyLinkUrl,
    subscriptions,
  };
}

export async function readVersion(
  client: FireflyClient,
  signal: AbortSignal = AbortSignal.timeout(READ_TIMEOUT_MS),
): Promise<string> {
  const about = (await client.get("about", {}, signal)) as WireAbout;
  if (typeof about.data?.version !== "string") throw new FireflyError("unreachable");
  return about.data.version;
}
