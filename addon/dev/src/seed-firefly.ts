import type { SeedData, SeedSplit } from "./seed-types";

/** Dev code only: the add-on's client never writes to a Firefly III. */
export async function seedFirefly(baseUrl: string, token: string, data: SeedData): Promise<void> {
  const base = baseUrl.replace(/\/+$/, "");

  // In order, one at a time: Firefly III numbers the rules in the order they arrive.
  async function send(method: "POST" | "PUT", path: string, body: unknown): Promise<{ data?: { id?: string } }> {
    const response = await fetch(`${base}/api/v1/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.api+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      redirect: "error",
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`seedFirefly: ${method} ${path} answered ${response.status}: ${text.slice(0, 500)}`);
    }
    return text === "" ? {} : (JSON.parse(text) as { data?: { id?: string } });
  }

  await send("POST", "currencies/DKK/primary", {});

  const ids = new Map<string, string>();
  for (const account of data.accounts) {
    const answer = await send("POST", "accounts", {
      name: account.name,
      type: "asset",
      account_role: "defaultAsset",
      currency_code: "DKK",
    });
    if (answer.data?.id === undefined) throw new Error(`seedFirefly: no id for the account ${account.name}`);
    ids.set(account.name, answer.data.id);
  }

  for (const name of data.categories) await send("POST", "categories", { name });

  for (const group of data.ruleGroups) {
    await send("POST", "rule-groups", { title: group.title });
    for (const rule of group.rules) {
      await send("POST", "rules", {
        title: rule.title,
        rule_group_title: group.title,
        trigger: "store-journal",
        active: rule.active,
        strict: true,
        triggers: rule.triggers.map((t) => ({ type: t.type, value: t.value, active: t.active ?? true })),
        actions: rule.actions.map((a) => ({ type: a.type, value: a.value, active: a.active ?? true })),
      });
    }
  }

  const split = (s: SeedSplit) => ({
    type: s.type,
    date: s.date,
    amount: s.amount,
    description: s.description,
    source_name: s.source,
    destination_name: s.destination,
    ...(s.category === undefined ? {} : { category_name: s.category }),
    ...(s.foreignAmount === undefined ? {} : { foreign_amount: s.foreignAmount }),
    ...(s.foreignCurrency === undefined ? {} : { foreign_currency_code: s.foreignCurrency }),
    ...(s.notes === undefined ? {} : { notes: s.notes }),
    ...(s.tags === undefined ? {} : { tags: s.tags }),
  });
  for (const group of data.transactions) {
    await send("POST", "transactions", {
      ...(group.groupTitle === undefined ? {} : { group_title: group.groupTitle }),
      transactions: group.splits.map(split),
    });
  }

  // Last, so an inactive account can still hold postings.
  for (const account of data.accounts) {
    if (!account.active) await send("PUT", `accounts/${ids.get(account.name)}`, { name: account.name, active: false });
  }
}
