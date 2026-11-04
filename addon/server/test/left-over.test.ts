import { createFakeFirefly, type SeedData, type SeedRule, type SeedSplit } from "@ha-spending/dev";
import type { LeftOverData, LeftOverMonth, Period } from "@ha-spending/shared";
import { describe, expect, it, vi } from "vitest";
import { createFireflyClient, getAllPages } from "../src/firefly/client";
import { leftOverMonths, readLeftOverData } from "../src/firefly/left-over";
import { type ReadSettings, readSpendingData } from "../src/firefly/read";
import type { WireGroup, WireSplit } from "../src/firefly/wire";

const settings: ReadSettings = {
  mainGroupRuleGroup: "Hovedgrupper",
  excludedMainGroups: ["Penge ind og ud"],
  fireflyLinkUrl: null,
  pageSize: 50,
  timeoutMs: 1000,
  members: ["Anna", "Bo"],
  savingsCategories: ["Opsparing"],
  creditAccounts: ["Kassekredit"],
};
const today = "2026-10-15";
const SEPTEMBER = { start: "2026-09-01", end: "2026-09-30" };
const SEP_TO_OCT = { start: "2026-09-01", end: "2026-10-31" };

function tagRule(category: string, tag: string): SeedRule {
  return {
    title: `${category} → ${tag}`,
    active: true,
    triggers: [{ type: "category_is", value: category }],
    actions: [{ type: "add_tag", value: tag }],
  };
}

function seedOf(splits: SeedSplit[]): SeedData {
  return {
    accounts: [
      { name: "Fælles", active: true },
      { name: "Budget", active: true },
      { name: "Kassekredit", active: true },
    ],
    otherAccounts: [{ name: "Billån", type: "liabilities", active: true }],
    categories: ["Dagligvarer", "Indskud", "Opsparing", "Afdrag"],
    ruleGroups: [
      {
        title: "Hovedgrupper",
        rules: [
          tagRule("Dagligvarer", "Mad"),
          tagRule("Indskud", "Penge ind og ud"),
          tagRule("Opsparing", "Penge ind og ud"),
          tagRule("Afdrag", "Penge ind og ud"),
        ],
      },
    ],
    transactions: splits.map((split) => ({ splits: [split] })),
  };
}

const withdrawal = (date: string, amount: string, destination: string, category?: string, source = "Fælles"):
  SeedSplit => ({ type: "withdrawal", date, amount, description: "Udgift", source, destination, category });
const deposit = (date: string, amount: string, source: string, category?: string, destination = "Fælles"):
  SeedSplit => ({ type: "deposit", date, amount, description: "Indtægt", source, destination, category });
const transfer = (date: string, amount: string, source: string, destination: string): SeedSplit =>
  ({ type: "transfer", date, amount, description: "Overførsel", source, destination });

function clientOf(splits: SeedSplit[]) {
  const fake = createFakeFirefly(seedOf(splits));
  return createFireflyClient({ baseUrl: "http://f", token: "fake-token", fetch: fake.fetch });
}

const sum = (amounts: number[]) => amounts.reduce((s, a) => s + a, 0);

/** Every answer holds the sum rule of spec §6.2, and Ind and Tilbage are the sums of their member lines. */
function expectConsistent(d: LeftOverData) {
  for (const m of d.months) {
    expect(m.change, m.month).toBe(m.paidIn - m.back - m.spending - m.credit - m.savings + m.other);
    expect(m.paidIn, m.month).toBe(sum(m.members.map((x) => x.paidIn)));
    expect(m.back, m.month).toBe(sum(m.members.map((x) => x.back)));
  }
}

async function read(
  splits: SeedSplit[],
  range: Period = SEPTEMBER,
  options: Partial<ReadSettings> = {},
  groups?: () => Promise<WireGroup[]>,
) {
  const warn = vi.fn();
  const data = await readLeftOverData(clientOf(splits), { ...settings, ...options }, range, { today, warn, groups });
  expectConsistent(data);
  return { data, warn };
}

const ZERO = { paidIn: 0, back: 0, members: [], spending: 0, savings: 0, credit: 0, other: 0, change: 0 };
const month = (name: string, fields: Partial<LeftOverMonth> = {}): LeftOverMonth => ({ month: name, ...ZERO, ...fields });
const monthOf = (d: LeftOverData, name: string) => d.months.find((m) => m.month === name);

/** The warning holds no name and no amount. */
function expectWarnedPlainly(warn: ReturnType<typeof vi.fn>, ...fragments: string[]) {
  expect(warn).toHaveBeenCalled();
  for (const [message] of warn.mock.calls) {
    for (const fragment of fragments) expect(String(message)).not.toContain(fragment);
  }
}

describe("readLeftOverData, the buckets", () => {
  it("a member's deposit in an excluded category is Ind", async () => {
    const { data, warn } = await read([deposit("2026-09-01", "10000.00", "Anna", "Indskud")]);
    expect(data.months).toEqual([
      month("2026-09", { paidIn: 1000000, members: [{ name: "Anna", paidIn: 1000000, back: 0 }], change: 1000000 }),
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("a member's deposit in a category that is not excluded is Forbrug, with the warning", async () => {
    const { data, warn } = await read([deposit("2026-09-01", "500.00", "Bo", "Dagligvarer")]);
    expect(data.months).toEqual([month("2026-09", { spending: -50000, change: 50000 })]);
    expectWarnedPlainly(warn, "Bo", "500");
  });

  it("money back to a member in an excluded category is Tilbage", async () => {
    const { data, warn } = await read([withdrawal("2026-09-20", "2000.00", "Anna", "Indskud")]);
    expect(data.months).toEqual([
      month("2026-09", { back: 200000, members: [{ name: "Anna", paidIn: 0, back: 200000 }], change: -200000 }),
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("money back to a member with no category is Forbrug, with the warning", async () => {
    const { data, warn } = await read([withdrawal("2026-09-20", "2000.00", "Anna")]);
    expect(data.months).toEqual([month("2026-09", { spending: 200000, change: -200000 })]);
    expectWarnedPlainly(warn, "Anna", "2000");
  });

  it("a member's deposit in one month and money back in the next, the members by name", async () => {
    const { data } = await read([
      deposit("2026-09-01", "3000.00", "Bo", "Indskud"),
      deposit("2026-09-02", "4000.00", "Anna", "Indskud"),
      withdrawal("2026-10-05", "1000.00", "Anna", "Indskud"),
    ], SEP_TO_OCT);
    expect(data.months).toEqual([
      month("2026-10", { back: 100000, members: [{ name: "Anna", paidIn: 0, back: 100000 }], change: -100000 }),
      month("2026-09", {
        paidIn: 700000,
        members: [{ name: "Anna", paidIn: 400000, back: 0 }, { name: "Bo", paidIn: 300000, back: 0 }],
        change: 700000,
      }),
    ]);
  });

  it("a savings withdrawal and its return cancel out over the two months", async () => {
    const { data, warn } = await read([
      withdrawal("2026-09-10", "1200.00", "Børneopsparing", "Opsparing"),
      deposit("2026-10-10", "1200.00", "Børneopsparing", "Opsparing"),
    ], SEP_TO_OCT);
    expect(data.months).toEqual([
      month("2026-10", { savings: -120000, change: 120000 }),
      month("2026-09", { savings: 120000, change: -120000 }),
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("spending and a refund are Forbrug", async () => {
    const { data, warn } = await read([
      withdrawal("2026-09-03", "400.00", "Netto", "Dagligvarer"),
      deposit("2026-09-04", "50.00", "Netto", "Dagligvarer"),
    ]);
    expect(data.months).toEqual([month("2026-09", { spending: 35000, change: -35000 })]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("interest, and a deposit from a revenue account that is not a member, are Øvrigt", async () => {
    const { data, warn } = await read([
      deposit("2026-09-30", "12.34", "Banken"),
      deposit("2026-09-15", "5000.00", "Arbejdsgiver", "Indskud"),
    ]);
    expect(data.months).toEqual([month("2026-09", { other: 501234, change: 501234 })]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("a transfer between daily accounts changes nothing", async () => {
    const { data } = await read([transfer("2026-09-05", "1000.00", "Fælles", "Budget")]);
    expect(data.months).toEqual([month("2026-09")]);
  });

  it("a transfer to the credit line pays it down and one from it draws on it", async () => {
    const { data } = await read([
      transfer("2026-09-05", "3000.00", "Fælles", "Kassekredit"),
      transfer("2026-10-05", "1000.00", "Kassekredit", "Budget"),
    ], SEP_TO_OCT);
    expect(data.months).toEqual([
      month("2026-10", { credit: -100000, change: 100000 }),
      month("2026-09", { credit: 300000, change: -300000 }),
    ]);
  });

  it("a withdrawal to the liability is Forbrug with no category and Øvrigt with an excluded one", async () => {
    const { data, warn } = await read([
      withdrawal("2026-09-01", "2500.00", "Billån"),
      withdrawal("2026-10-01", "2500.00", "Billån", "Afdrag"),
    ], SEP_TO_OCT);
    expect(data.months).toEqual([
      month("2026-10", { other: -250000, change: -250000 }),
      month("2026-09", { spending: 250000, change: -250000 }),
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("a withdrawal from the credit line to the liability is Øvrigt and moves Kreditten down", async () => {
    const { data } = await read([withdrawal("2026-09-01", "1000.00", "Billån", "Afdrag", "Kassekredit")]);
    expect(data.months).toEqual([month("2026-09", { credit: -100000, other: -100000 })]);
  });

  it("a credit name that is the liability is no credit line", async () => {
    const { data } = await read([withdrawal("2026-09-01", "1000.00", "Billån", "Afdrag")], SEPTEMBER,
      { creditAccounts: ["Billån"] });
    expect(data.months).toEqual([month("2026-09", { other: -100000, change: -100000 })]);
  });
});

/** One of each kind, over three months, with a month left empty. */
const household: SeedSplit[] = [
  deposit("2026-07-01", "12000.00", "Anna", "Indskud"),
  deposit("2026-07-01", "11000.00", "Bo", "Indskud"),
  withdrawal("2026-07-03", "812.45", "Netto", "Dagligvarer"),
  deposit("2026-07-04", "99.95", "Netto", "Dagligvarer"),
  withdrawal("2026-07-05", "300.00", "Anna", "Dagligvarer"),
  withdrawal("2026-07-06", "2500.00", "Billån"),
  withdrawal("2026-07-07", "2500.00", "Billån", "Afdrag"),
  withdrawal("2026-07-08", "1000.00", "Billån", "Afdrag", "Kassekredit"),
  transfer("2026-07-09", "4000.00", "Kassekredit", "Fælles"),
  transfer("2026-07-10", "250.00", "Fælles", "Budget"),
  withdrawal("2026-07-11", "1200.00", "Børneopsparing", "Opsparing"),
  deposit("2026-07-31", "3.21", "Banken"),
  withdrawal("2026-07-20", "75.50", "Café", undefined, "Budget"),
  deposit("2026-09-01", "12000.00", "Anna", "Indskud"),
  withdrawal("2026-09-02", "1500.00", "Bo", "Indskud"),
  withdrawal("2026-09-03", "640.10", "Netto", "Dagligvarer", "Kassekredit"),
  transfer("2026-09-04", "2000.00", "Budget", "Kassekredit"),
  deposit("2026-09-05", "600.00", "Børneopsparing", "Opsparing"),
  withdrawal("2026-09-06", "123.45", "Netto", "Dagligvarer"),
];
const SUMMER = { start: "2026-07-01", end: "2026-09-30" };

describe("readLeftOverData, the sums", () => {
  it("an opening balance and a reconciliation change no amount", async () => {
    const special: SeedSplit[] = [
      { type: "opening balance", date: "2026-07-01", amount: "50000.00", description: "Startsaldo",
        source: "Fælles startsaldo", destination: "Fælles" },
      { type: "reconciliation", date: "2026-09-15", amount: "17.00", description: "Afstemning",
        source: "Afstemning af Kassekredit", destination: "Kassekredit" },
    ];
    const { data: without } = await read(household, SUMMER);
    const { data: withThem } = await read([...household, ...special], SUMMER);
    expect(withThem.months).toEqual(without.months);
  });

  it("holds the sum rule in every month, with every bucket in use", async () => {
    const { data } = await read(household, SUMMER);
    expect(data.months.map((m) => m.month)).toEqual(["2026-09", "2026-08", "2026-07"]);
    const used = (key: keyof Omit<LeftOverMonth, "month" | "members">) => data.months.some((m) => m[key] !== 0);
    for (const key of ["paidIn", "back", "spending", "savings", "credit", "other", "change"] as const) {
      expect(used(key), key).toBe(true);
    }
  });

  it("Forbrug is the sum of /api/data's postings for the same days", async () => {
    const client = clientOf(household);
    const left = await readLeftOverData(client, settings, SUMMER, { today, warn: () => {} });
    const data = await readSpendingData(client, settings, SUMMER, { today, warn: () => {} });
    for (const m of left.months) {
      const postings = data.postings.filter((p) => p.date.startsWith(m.month));
      expect(m.spending, m.month).toBe(sum(postings.map((p) => p.amount)));
    }
    expect(monthOf(left, "2026-07")!.spending).not.toBe(0);
  });
});

describe("readLeftOverData, the edges", () => {
  it("a month cut by the range counts only its days in the range", async () => {
    const splits = [
      withdrawal("2026-09-10", "100.00", "Netto", "Dagligvarer"),
      withdrawal("2026-09-20", "200.00", "Netto", "Dagligvarer"),
    ];
    const range = { start: "2026-09-15", end: "2026-10-31" };
    const { data } = await read(splits, range);
    expect(data.months).toEqual([month("2026-10"), month("2026-09", { spending: 20000, change: -20000 })]);

    const client = clientOf(splits);
    const wider = () => getAllPages<WireGroup>(client, "transactions", { ...SEPTEMBER, type: "all" }, 50);
    const { data: given } = await read(splits, range, {}, wider);
    expect(given.months).toEqual(data.months);
  });

  it("a posting after today counts", async () => {
    const { data } = await read([withdrawal("2026-10-25", "100.00", "Netto", "Dagligvarer")], {
      start: "2026-10-01",
      end: "2026-10-31",
    });
    expect(data.today).toBe(today);
    expect(data.months).toEqual([month("2026-10", { spending: 10000, change: -10000 })]);
  });

  it("a month with no postings still has its month, every amount 0", async () => {
    const { data } = await read([
      withdrawal("2026-08-10", "100.00", "Netto", "Dagligvarer"),
      withdrawal("2026-10-10", "100.00", "Netto", "Dagligvarer"),
    ], { start: "2026-08-01", end: "2026-10-31" });
    expect(monthOf(data, "2026-09")).toEqual(month("2026-09"));
    expect(data.months.map((m) => m.month)).toEqual(["2026-10", "2026-09", "2026-08"]);
  });

  it("the custom range 15 Sep to 10 Nov has November, October and September, only their days in it", async () => {
    const range = { start: "2026-09-15", end: "2026-11-10" };
    const { data } = await read([
      withdrawal("2026-09-14", "1.00", "Netto", "Dagligvarer"),
      withdrawal("2026-09-15", "10.00", "Netto", "Dagligvarer"),
      withdrawal("2026-11-10", "100.00", "Netto", "Dagligvarer"),
      withdrawal("2026-11-11", "1000.00", "Netto", "Dagligvarer"),
    ], range);
    expect(data.range).toEqual(range);
    expect(data.months).toEqual([
      month("2026-11", { spending: 10000, change: -10000 }),
      month("2026-10"),
      month("2026-09", { spending: 1000, change: -1000 }),
    ]);
  });

  it("a member's name used as a shop is Forbrug, with the warning", async () => {
    const { data, warn } = await read([withdrawal("2026-09-12", "350.00", "Anna", "Dagligvarer")]);
    expect(data.months).toEqual([month("2026-09", { spending: 35000, change: -35000 })]);
    expectWarnedPlainly(warn, "Anna", "350");
  });
});

describe("readLeftOverData, the columns to show", () => {
  const columns = async (options: Partial<ReadSettings>) => {
    const { data } = await read([], SEPTEMBER, options);
    return { hasSavings: data.hasSavings, hasCredit: data.hasCredit };
  };

  it("hides both with the options empty", async () => {
    expect(await columns({ savingsCategories: [], creditAccounts: [] })).toEqual({ hasSavings: false, hasCredit: false });
    expect(await columns({ savingsCategories: undefined, creditAccounts: undefined }))
      .toEqual({ hasSavings: false, hasCredit: false });
  });

  it("hides both with only unknown names", async () => {
    expect(await columns({ savingsCategories: ["Ferie"], creditAccounts: ["Findes ikke"] }))
      .toEqual({ hasSavings: false, hasCredit: false });
  });

  it("hides Kreditten with only the liability's name", async () => {
    expect(await columns({ creditAccounts: ["Billån"] })).toMatchObject({ hasCredit: false });
  });

  it("shows both with a matching name among unknown ones", async () => {
    expect(await columns({ savingsCategories: ["Ferie", "Opsparing"], creditAccounts: ["Billån", "Kassekredit"] }))
      .toEqual({ hasSavings: true, hasCredit: true });
  });
});

describe("readSpendingData's leftOver", () => {
  const leftOver = async (splits: SeedSplit[], members: string[] | undefined) =>
    (await readSpendingData(clientOf(splits), { ...settings, members }, SEPTEMBER, { today, warn: () => {} })).leftOver;

  it("is true when a member is a revenue account", async () => {
    expect(await leftOver([deposit("2026-09-01", "100.00", "Bo", "Indskud")], ["Anna", "Bo"])).toBe(true);
  });

  it("is false with no members, or when a member is only an expense account", async () => {
    expect(await leftOver([deposit("2026-09-01", "100.00", "Bo", "Indskud")], [])).toBe(false);
    expect(await leftOver([deposit("2026-09-01", "100.00", "Bo", "Indskud")], undefined)).toBe(false);
    expect(await leftOver([withdrawal("2026-09-01", "100.00", "Anna", "Indskud")], ["Anna"])).toBe(false);
  });
});

describe("leftOverMonths", () => {
  it("a transfer to a liability in a savings category is Øvrigt, as only withdrawals and deposits are Opsparing", () => {
    const split: WireSplit = {
      transaction_journal_id: "1", type: "transfer", date: "2026-09-10T00:00:00+02:00", amount: "700.000000000000",
      currency_code: "DKK", foreign_amount: null, foreign_currency_code: null, description: "Afdrag",
      source_id: "1", source_name: "Fælles", source_type: "Asset account",
      destination_id: "2", destination_name: "Billån", destination_type: "Loan",
      category_id: "3", category_name: "Opsparing", tags: [], notes: null, bill_id: null,
    };
    const warn = vi.fn();
    const months = leftOverMonths([{ id: "1", attributes: { group_title: null, transactions: [split] } }], SEPTEMBER, {
      members: new Set(["Anna"]),
      savingsCategories: new Set(["Opsparing"]),
      creditAccounts: new Set(),
      mainGroupOf: () => "Penge ind og ud",
      excluded: new Set(["Penge ind og ud"]),
      warn,
    });
    expect(months).toEqual([month("2026-09", { other: -70000, change: -70000 })]);
    expect(warn).not.toHaveBeenCalled();
  });
});
