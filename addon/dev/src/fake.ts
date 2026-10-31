import type { Context } from "hono";
import { Hono } from "hono";
import { addDays } from "@ha-spending/shared";
import type { SeedData, SeedSplit } from "./seed-types";

export type Fault = "refused" | "error" | "slow" | null;

export interface FakeFirefly {
  /** Honours `init.signal`. */
  fetch: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
  requests: { method: string; path: string }[];
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

type AccountType = "Asset account" | "Expense account" | "Revenue account";

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

  function account(name: string, type: AccountType): string {
    if (type === "Asset account") {
      const id = assetIds.get(name);
      if (!id) throw new Error(`The seed names an asset account it does not list: ${name}`);
      return id;
    }
    const key = `${type}\u0000${name}`;
    if (!others.has(key)) others.set(key, nextId());
    return others.get(key)!;
  }

  function ends(split: SeedSplit): [AccountType, AccountType] {
    if (split.type === "withdrawal") return ["Asset account", "Expense account"];
    if (split.type === "deposit") return ["Revenue account", "Asset account"];
    return ["Asset account", "Asset account"];
  }

  for (const t of data.transactions) {
    for (const s of t.splits) {
      const [from, to] = ends(s);
      account(s.source, from);
      account(s.destination, to);
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
          destination_id: account(s.destination, destinationType),
          destination_name: s.destination,
          destination_type: destinationType,
          category_id: categoryId,
          category_name: s.category ?? null,
          tags: [],
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

  return { assets, categories, groups, ruleGroups };
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
    fake.requests.push({ method: c.req.method, path: c.req.path });
    if (c.req.method !== "GET") return c.json({ message: "Method not allowed." }, 405);
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

  app.get("/api/v1/accounts", (c) => {
    const type = c.req.query("type");
    const listed = type === undefined || type === "asset" ? built.assets : [];
    const shown = options.hideInactiveAccounts ? listed.filter((a) => a.active) : listed;
    return page(
      c,
      shown.map((a) => ({ id: a.id, attributes: { name: a.name, type: "asset", currency_code: "DKK", active: a.active } })),
    );
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
