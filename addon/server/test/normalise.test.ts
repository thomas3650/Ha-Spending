import { describe, expect, it } from "vitest";
import { spendingKind, toPostings } from "../src/firefly/normalise";
import type { WireGroup, WireSplit } from "../src/firefly/wire";

const mainGroups: Record<string, string> = {
  Dagligvarer: "Mad",
  Brændstof: "Bil",
  Indskud: "Penge ind og ud",
  Opsparing: "Penge ind og ud",
};
const mainGroupOf = (category: string | null) => (category === null ? null : (mainGroups[category] ?? null));
const excluded = new Set(["Penge ind og ud"]);
const noLinks = () => null;

let nextId = 100;

function split(fields: Partial<WireSplit>): WireSplit {
  return {
    transaction_journal_id: String(++nextId),
    type: "withdrawal",
    date: "2026-01-10T00:00:00+01:00",
    amount: "100.000000000000",
    currency_code: "DKK",
    foreign_amount: null,
    foreign_currency_code: null,
    description: "Indkøb",
    source_id: "1",
    source_name: "Konto A",
    source_type: "Asset account",
    destination_id: "50",
    destination_name: "Netto",
    destination_type: "Expense account",
    category_id: "10",
    category_name: "Dagligvarer",
    tags: [],
    notes: null,
    bill_id: null,
    ...fields,
  };
}

const deposit = (fields: Partial<WireSplit>) =>
  split({
    type: "deposit",
    source_id: "60",
    source_name: "Netto",
    source_type: "Revenue account",
    destination_id: "1",
    destination_name: "Konto A",
    destination_type: "Asset account",
    ...fields,
  });

function group(id: string, ...splits: WireSplit[]): WireGroup {
  return { id, attributes: { group_title: splits.length > 1 ? "Indkøb" : null, transactions: splits } };
}

describe("toPostings", () => {
  it("makes one posting per split, keeping the local date", () => {
    const summer = split({ date: "2026-07-01T00:00:00+02:00", description: "Netto i juli" });
    expect(toPostings([group("7", summer)], mainGroupOf, excluded, noLinks)).toEqual([
      {
        id: summer.transaction_journal_id,
        groupId: "7",
        date: "2026-07-01",
        text: "Netto i juli",
        account: "1",
        category: "Dagligvarer",
        kind: "spending",
        shop: "Netto",
        amount: 10000,
        subscription: null,
      },
    ]);

    const food = split({ amount: "200.000000000000" });
    const gift = split({ amount: "150.000000000000", category_id: null, category_name: null });
    const postings = toPostings([group("8", food, gift)], mainGroupOf, excluded, noLinks);
    expect(postings.map((p) => [p.groupId, p.id, p.category, p.amount])).toEqual([
      ["8", food.transaction_journal_id, "Dagligvarer", 20000],
      ["8", gift.transaction_journal_id, null, 15000],
    ]);
  });

  it("signs refunds and drops income, transfers and the rest", () => {
    const refund = deposit({ amount: "50.250000000000", description: "Returvare" });
    const groups = [
      group("1", refund),
      group("2", deposit({ category_id: null, category_name: null, description: "Løn" })),
      group("3", split({ type: "transfer", destination_type: "Asset account", category_name: null })),
      group("4", split({ type: "opening balance" })),
      group("5", split({ type: "reconciliation" })),
    ];
    expect(toPostings(groups, mainGroupOf, excluded, noLinks)).toEqual([
      {
        id: refund.transaction_journal_id,
        groupId: "1",
        date: "2026-01-10",
        text: "Returvare",
        account: "1",
        category: "Dagligvarer",
        kind: "refund",
        shop: "Netto",
        amount: -5025,
        subscription: null,
      },
    ]);
  });

  it("drops excluded main groups both ways", () => {
    const groups = [
      group("1", deposit({ category_name: "Indskud" })),
      group("2", split({ category_name: "Opsparing" })),
    ];
    expect(toPostings(groups, mainGroupOf, excluded, noLinks)).toEqual([]);
    expect(toPostings(groups, mainGroupOf, new Set(), noLinks)).toHaveLength(2);
  });

  it("uses the amount in kroner, not the foreign one", () => {
    const hotel = split({
      amount: "745.000000000000",
      foreign_amount: "100.000000000000",
      foreign_currency_code: "EUR",
    });
    expect(toPostings([group("1", hotel)], mainGroupOf, excluded, noLinks).map((p) => p.amount)).toEqual([74500]);
  });

  it("gives a withdrawal's expense account as its shop", () => {
    const [p] = toPostings([group("1", split({ destination_name: "Netto" }))], mainGroupOf, excluded, noLinks);
    expect(p?.shop).toBe("Netto");
  });

  it("gives a refund's revenue account as its shop", () => {
    const [p] = toPostings([group("1", deposit({ source_name: "Café Søde" }))], mainGroupOf, excluded, noLinks);
    expect(p).toMatchObject({ kind: "refund", shop: "Café Søde" });
  });

  it("gives no shop for (no name), in any case", () => {
    const shops = ["(no name)", "(No Name)"].map(
      (name) => toPostings([group("1", split({ destination_name: name }))], mainGroupOf, excluded, noLinks)[0]?.shop,
    );
    expect(shops).toEqual([null, null]);
  });

  it("gives no shop for other account types", () => {
    const cash = split({ destination_name: "Cash account", destination_type: "Cash account" });
    const asset = deposit({ source_name: "Konto B", source_type: "Asset account" });
    const postings = toPostings([group("1", cash), group("2", asset)], mainGroupOf, excluded, noLinks);
    expect(postings.map((p) => p.shop)).toEqual([null, null]);
  });
});

describe("spendingKind", () => {
  const kindOf = (s: WireSplit) => spendingKind(s, mainGroupOf, excluded);

  it("names what the overview counts, as toPostings does", () => {
    expect(kindOf(split({}))).toBe("spending");
    expect(kindOf(split({ category_id: null, category_name: null }))).toBe("spending");
    expect(kindOf(deposit({}))).toBe("refund");
  });

  it("is null for what the overview leaves out", () => {
    expect(kindOf(split({ category_name: "Opsparing" }))).toBeNull();
    expect(kindOf(deposit({ category_name: "Indskud" }))).toBeNull();
    expect(kindOf(deposit({ category_id: null, category_name: null }))).toBeNull();
    expect(kindOf(split({ type: "transfer", destination_type: "Asset account" }))).toBeNull();
    expect(kindOf(split({ source_type: "Loan" }))).toBeNull();
  });
});
