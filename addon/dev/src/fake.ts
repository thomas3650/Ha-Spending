import type { Context } from "hono";
import { Hono } from "hono";
import { addDays } from "@ha-spending/shared";
import type { SeedData, SeedSplit } from "./seed-types";

export type Fault = "refused" | "error" | "slow" | null;

export interface FakeFirefly {
  /** Honours `init.signal`. */
  fetch: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
  /** A PUT also records the body it sent. */
  requests: { method: string; path: string; body?: unknown }[];
  /** `refused` answers 401, `error` 500, `slow` after 60 s. */
  fault: Fault;
}

export interface FakeOptions {
  token?: string;
  version?: string;
  maxPerPage?: number;
  hideInactiveAccounts?: boolean;
}

const SLOW_MS = 60_000;
const DEFAULT_PER_PAGE = 50;

interface FakeAccount {
  id: string;
  name: string;
  type: "asset" | "expense" | "revenue" | "liabilities";
  active: boolean;
}

const ACCOUNT_TYPES = new Set(["all", "asset", "expense", "revenue", "liabilities"]);

type AccountType = "Asset account" | "Expense account" | "Revenue account" | "Loan";

interface Item {
  id: string;
  attributes: Record<string, unknown>;
}

const copenhagenOffset = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Copenhagen", timeZoneName: "longOffset" });

/** Firefly III's dates carry Copenhagen's offset at local midnight: +01:00, or +02:00 in summer. */
function fireflyDate(date: string): string {
  const [year, month, day] = addDays(date, -1).split("-").map(Number);
  // 23:00 UTC the day before is midnight at +01:00, before either switch of the day.
  const instant = new Date(Date.UTC(year, month - 1, day, 23));
  const name = copenhagenOffset.formatToParts(instant).find((p) => p.type === "timeZoneName")?.value ?? "GMT+01:00";
  return `${date}T00:00:00${name.replace("GMT", "")}`;
}

function fireflyAmount(amount: string): string {
  const [whole, fraction = ""] = amount.split(".");
  return `${whole}.${fraction.padEnd(12, "0")}`;
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

function aborted(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    if (signal.aborted) return reject(signal.reason);
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
}

function buildData(data: SeedData) {
  let next = 0;
  const nextId = () => String(++next);

  const assets = data.accounts.map((a) => ({ id: nextId(), ...a }));
  const assetIds = new Map(assets.map((a) => [a.name, a.id]));
  const others = new Map<string, string>();
  const NO_NAME = "(no name)";
  const extra = (data.otherAccounts ?? []).map((a) => ({ id: nextId(), ...a }));
  // Firefly III lets a withdrawal pay a liability.
  const liabilityIds = new Map(extra.filter((a) => a.type === "liabilities").map((a) => [a.name, a.id]));

  function account(name: string, type: AccountType): string {
    if (type === "Asset account") {
      const id = assetIds.get(name);
      if (!id) throw new Error(`The seed names an asset account it does not list: ${name}`);
      return id;
    }
    if (type === "Loan") return liabilityIds.get(name)!;
    const key = `${type}\u0000${name}`;
    if (!others.has(key)) others.set(key, nextId());
    return others.get(key)!;
  }

  function destinationName(split: SeedSplit): string {
    if (split.destination !== undefined) return split.destination;
    if (split.type !== "withdrawal") throw new Error(`The seed leaves out the destination of a ${split.type}`);
    return NO_NAME;
  }

  const paysLiability = (split: SeedSplit) =>
    split.type === "withdrawal" && split.destination !== undefined && liabilityIds.has(split.destination);

  function ends(split: SeedSplit): [AccountType, AccountType] {
    if (paysLiability(split)) return ["Asset account", "Loan"];
    if (split.type === "withdrawal") return ["Asset account", "Expense account"];
    if (split.type === "deposit") return ["Revenue account", "Asset account"];
    return ["Asset account", "Asset account"];
  }

  for (const t of data.transactions) {
    for (const s of t.splits) {
      const [from, to] = ends(s);
      account(s.source, from);
      account(destinationName(s), to);
    }
  }

  const categories = data.categories.map((name) => ({ id: nextId(), name }));
  const categoryIds = new Map(categories.map((c) => [c.name, c.id]));

  const groupIds = data.transactions.map(() => nextId());
  const groups = data.transactions.map((t, i) => ({
    id: groupIds[i],
    date: t.splits[0].date,
    attributes: {
      group_title: t.splits.length > 1 ? (t.groupTitle ?? null) : null,
      transactions: t.splits.map((s) => {
        const [sourceType, destinationType] = ends(s);
        const categoryId = s.category === undefined ? null : categoryIds.get(s.category);
        if (categoryId === undefined) throw new Error(`The seed names a category it does not list: ${s.category}`);
        return {
          transaction_journal_id: nextId(),
          type: s.type,
          date: fireflyDate(s.date),
          amount: fireflyAmount(s.amount),
          currency_code: "DKK",
          foreign_amount: s.foreignAmount === undefined ? null : fireflyAmount(s.foreignAmount),
          foreign_currency_code: s.foreignCurrency ?? null,
          description: s.description,
          source_id: account(s.source, sourceType),
          source_name: s.source,
          source_type: sourceType,
          destination_id: account(destinationName(s), destinationType),
          destination_name: destinationName(s),
          destination_type: destinationType,
          category_id: categoryId,
          category_name: s.category ?? null,
          tags: s.tags ?? [],
          notes: s.notes ?? null,
        };
      }),
    },
  }));
  groups.sort((a, b) => (a.date === b.date ? Number(b.id) - Number(a.id) : a.date < b.date ? 1 : -1));

  const ruleGroups = data.ruleGroups.map((g, i) => ({
    id: nextId(),
    attributes: { title: g.title, order: i + 1, active: true },
    rules: g.rules.map((r, j) => ({
      id: nextId(),
      attributes: {
        title: r.title,
        order: j + 1,
        active: r.active,
        triggers: r.triggers.map((x) => ({ type: x.type, value: x.value, active: x.active ?? true })),
        actions: r.actions.map((x) => ({ type: x.type, value: x.value, active: x.active ?? true })),
      },
    })),
  }));

  const accounts: FakeAccount[] = [
    ...assets.map((a) => ({ id: a.id, name: a.name, type: "asset" as const, active: a.active })),
    ...[...others].map(([key, id]) => {
      const [type, name] = key.split("\u0000");
      return { id, name, type: type === "Expense account" ? ("expense" as const) : ("revenue" as const), active: true };
    }),
    ...extra,
  ].sort((a, b) => Number(a.id) - Number(b.id));

  return { assets, accounts, categories, groups, ruleGroups, nextId };
}

type FakeSplit = ReturnType<typeof buildData>["groups"][number]["attributes"]["transactions"][number];

const SEARCH_TERM = /^(-?)([a-z_]+):(?:"([^"]*)"|(\S+))$/;

/** The few search operators the add-on sends; `null` for anything else, so a typo in a query fails a test. */
function searchFilter(query: string): ((split: FakeSplit) => boolean) | null {
  const terms = query.match(/-?[a-z_]+:(?:"[^"]*"|\S+)/g) ?? [];
  if (terms.length === 0 || terms.join(" ") !== query.trim().replace(/\s+/g, " ")) return null;
  const tests: ((split: FakeSplit) => boolean)[] = [];
  for (const term of terms) {
    const [, negated, operator, quoted, bare] = SEARCH_TERM.exec(term)!;
    const value = quoted ?? bare;
    let test: (split: FakeSplit) => boolean;
    if (operator === "has_any_category" && value === "true") test = (s) => s.category_id !== null;
    else if (operator === "category_is") test = (s) => s.category_name === value;
    else if (operator === "journal_id" && /^[0-9]+$/.test(value)) test = (s) => s.transaction_journal_id === value;
    else if (operator === "type") test = (s) => s.type === value;
    else return null;
    tests.push(negated ? (s) => !test(s) : test);
  }
  return (split) => tests.every((t) => t(split));
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const GROUP_KEYS = new Set(["apply_rules", "fire_webhooks", "group_title", "transactions"]);
const SPLIT_KEYS = new Set(["transaction_journal_id", "category_id", "tags", "destination_id"]);

/**
 * Firefly III's update of a group, for the fields the sorter sends; any other field is refused, so a test sees one
 * sent. As in Firefly III, a split the body does not list is deleted, and `tags` replaces the split's tags.
 */
function updateGroup(
  group: { group_title: string | null; transactions: FakeSplit[] },
  body: unknown,
  categories: { id: string; name: string }[],
  accounts: FakeAccount[],
): string | null {
  if (!isRecord(body) || !Array.isArray(body.transactions)) return "The body has no transactions.";
  const extra = Object.keys(body).find((key) => !GROUP_KEYS.has(key));
  if (extra !== undefined) return `The fake does not take ${extra}.`;
  const entries = body.transactions as unknown[];
  if (entries.length > 1 && typeof body.group_title !== "string") {
    return "A group title is mandatory when there is more than one transaction.";
  }
  const single = entries.length === 1 && group.transactions.length === 1;
  const updates: { split: FakeSplit; entry: Record<string, unknown> }[] = [];
  for (const entry of entries) {
    if (!isRecord(entry)) return "A transaction is not an object.";
    const field = Object.keys(entry).find((key) => !SPLIT_KEYS.has(key));
    if (field !== undefined) return `The fake does not take ${field}.`;
    const split = single
      ? group.transactions[0]
      : group.transactions.find((s) => s.transaction_journal_id === entry.transaction_journal_id);
    if (!split) return "The fake does not create splits.";
    if (entry.category_id !== undefined && !categories.some((x) => x.id === entry.category_id)) {
      return "Unknown category.";
    }
    if (entry.destination_id !== undefined) {
      const target = accounts.find((a) => a.id === entry.destination_id);
      if (target?.type !== "expense") return "Unknown destination.";
      if (split.type !== "withdrawal") return "Only a withdrawal has an expense account as its destination.";
    }
    const tags = entry.tags;
    if (tags !== undefined && !(Array.isArray(tags) && tags.every((t) => typeof t === "string"))) {
      return "The tags are not a list of text.";
    }
    updates.push({ split, entry });
  }
  if (typeof body.group_title === "string") group.group_title = body.group_title;
  for (const { split, entry } of updates) {
    if (entry.category_id !== undefined) {
      split.category_id = entry.category_id as string;
      split.category_name = categories.find((x) => x.id === entry.category_id)!.name;
    }
    if (entry.destination_id !== undefined) {
      split.destination_id = entry.destination_id as string;
      split.destination_name = accounts.find((a) => a.id === entry.destination_id)!.name;
    }
    if (entry.tags !== undefined) split.tags = [...(entry.tags as string[])];
  }
  group.transactions = updates.map((u) => u.split).sort((a, b) =>
    group.transactions.indexOf(a) - group.transactions.indexOf(b));
  return null;
}

export function createFakeFirefly(data: SeedData, options: FakeOptions = {}): FakeFirefly {
  const token = options.token ?? "fake-token";
  const version = options.version ?? "6.7.9";
  const built = buildData(data);
  const app = new Hono();

  const fake: FakeFirefly = {
    requests: [],
    fault: null,
    fetch: async (input, init) => {
      const request = new Request(input, init);
      const answer = app.fetch(request);
      if (!init?.signal) return answer;
      return Promise.race([answer, aborted(init.signal)]);
    },
  };

  const accountItem = (a: FakeAccount): Item => ({
    id: a.id,
    attributes: { name: a.name, type: a.type, active: a.active, currency_code: "DKK" },
  });

  function page(c: Context, items: Item[]) {
    const asked = Number(c.req.query("limit") ?? DEFAULT_PER_PAGE);
    let perPage = Number.isInteger(asked) && asked > 0 ? asked : DEFAULT_PER_PAGE;
    if (options.maxPerPage !== undefined) perPage = Math.min(perPage, options.maxPerPage);
    const askedPage = Number(c.req.query("page") ?? 1);
    const current = Number.isInteger(askedPage) && askedPage > 0 ? askedPage : 1;
    const totalPages = Math.max(1, Math.ceil(items.length / perPage));
    const slice = items.slice((current - 1) * perPage, current * perPage);

    const link = (n: number) => {
      const url = new URL(c.req.url);
      url.searchParams.set("page", String(n));
      return url.toString();
    };
    const links: Record<string, string> = { self: link(current), first: link(1) };
    if (current < totalPages) links.next = link(current + 1);
    links.last = link(totalPages);

    return c.json({
      data: slice,
      meta: {
        pagination: {
          total: items.length,
          count: slice.length,
          per_page: perPage,
          current_page: current,
          total_pages: totalPages,
        },
      },
      links,
    });
  }

  app.use(async (c, next) => {
    const { method, path } = c.req;
    if (method === "PUT" || (method === "POST" && path === "/api/v1/accounts")) {
      fake.requests.push({ method, path, body: await c.req.raw.clone().json().catch(() => null) });
    } else {
      fake.requests.push({ method, path });
    }
    const writable =
      (method === "PUT" && /^\/api\/v1\/transactions\/[0-9]+$/.test(path)) ||
      (method === "POST" && path === "/api/v1/accounts");
    if (method !== "GET" && !writable) return c.json({ message: "Method not allowed." }, 405);
    await next();
  });

  app.get("/transactions/show/:id{[0-9]+}", (c) =>
    c.html(`<!doctype html><title>Firefly III</title><p>Transaction ${c.req.param("id")}</p>`),
  );

  app.use("/api/*", async (c, next) => {
    if (fake.fault === "slow") {
      try {
        await delay(SLOW_MS, c.req.raw.signal);
      } catch {
        // The caller has gone; nobody reads this answer.
        return c.body(null, 503);
      }
    }
    if (fake.fault === "error") return c.json({ message: "Internal server error.", exception: "Exception" }, 500);
    if (fake.fault === "refused" || c.req.header("Authorization") !== `Bearer ${token}`) {
      return c.json({ message: "Unauthenticated.", exception: "AuthenticationException" }, 401);
    }
    await next();
  });

  app.get("/api/v1/about", (c) => c.json({ data: { version, api_version: "2.1.0", driver: "sqlite" } }));

  app.get("/api/v1/transactions", (c) => {
    const start = c.req.query("start") ?? "0000-01-01";
    const end = c.req.query("end") ?? "9999-12-31";
    const type = c.req.query("type") ?? "all";
    const inside = built.groups.filter(
      (g) => g.date >= start && g.date <= end && (type === "all" || g.attributes.transactions[0].type === type),
    );
    return page(c, inside.map((g) => ({ id: g.id, attributes: g.attributes })));
  });

  app.get("/api/v1/search/transactions", (c) => {
    const matches = searchFilter(c.req.query("query") ?? "");
    if (matches === null) return c.json({ message: "The fake does not know this query.", errors: {} }, 422);
    // As Firefly III does: a group comes with the splits that match, not with all of its splits.
    const hits = built.groups
      .map((g) => ({ id: g.id, attributes: { ...g.attributes, transactions: g.attributes.transactions.filter(matches) } }))
      .filter((g) => g.attributes.transactions.length > 0);
    return page(c, hits);
  });

  app.get("/api/v1/transactions/:id{[0-9]+}", (c) => {
    const group = built.groups.find((g) => g.id === c.req.param("id"));
    if (!group) return c.json({ message: "Resource not found", exception: "NotFoundHttpException" }, 404);
    return c.json({ data: { id: group.id, attributes: group.attributes } });
  });

  app.put("/api/v1/transactions/:id{[0-9]+}", async (c) => {
    const group = built.groups.find((g) => g.id === c.req.param("id"));
    if (!group) return c.json({ message: "Resource not found", exception: "NotFoundHttpException" }, 404);
    const body = await c.req.json<unknown>().catch(() => null);
    const outcome = updateGroup(group.attributes, body, built.categories, built.accounts);
    if (typeof outcome === "string") return c.json({ message: outcome, errors: {} }, 422);
    return c.json({ data: { id: group.id, attributes: group.attributes } });
  });

  app.get("/api/v1/accounts", (c) => {
    const type = c.req.query("type") ?? "asset";
    if (!ACCOUNT_TYPES.has(type)) return c.json({ message: "Unknown account type.", errors: {} }, 422);
    const shown = built.accounts.filter(
      (a) => (type === "all" || a.type === type) && (!options.hideInactiveAccounts || a.active),
    );
    return page(c, shown.map(accountItem));
  });

  app.post("/api/v1/accounts", async (c) => {
    const body = await c.req.json<unknown>().catch(() => null);
    if (!isRecord(body) || typeof body.name !== "string" || body.name === "" || body.type !== "expense") {
      return c.json({ message: "The fake makes expense accounts with a name.", errors: {} }, 422);
    }
    const name = body.name;
    if (built.accounts.some((a) => a.name === name)) {
      return c.json({ message: "The name is already in use.", errors: {} }, 422);
    }
    const made: FakeAccount = { id: built.nextId(), name, type: "expense", active: true };
    built.accounts.push(made);
    return c.json({ data: accountItem(made) });
  });

  app.get("/api/v1/categories", (c) =>
    page(c, built.categories.map((x) => ({ id: x.id, attributes: { name: x.name } }))),
  );

  app.get("/api/v1/rule-groups", (c) =>
    page(c, built.ruleGroups.map((g) => ({ id: g.id, attributes: g.attributes }))),
  );

  app.get("/api/v1/rule-groups/:id/rules", (c) => {
    const group = built.ruleGroups.find((g) => g.id === c.req.param("id"));
    if (!group) return c.json({ message: "Resource not found", exception: "NotFoundHttpException" }, 404);
    return page(c, group.rules);
  });

  app.all("/api/*", (c) => c.json({ message: "Resource not found", exception: "NotFoundHttpException" }, 404));

  return fake;
}
