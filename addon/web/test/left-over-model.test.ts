import type { LeftOverData, LeftOverMember, LeftOverMonth } from "@ha-spending/shared";
import { describe, expect, it } from "vitest";
import { kr } from "../src/format";
import {
  type Cell,
  type Column,
  leftOverCard,
  leftOverTable,
  roundKroner,
  type Row,
  signedKroner,
} from "../src/model/left-over";
import { leftOverFor } from "./fixture";

const TODAY = "2026-10-30";

type Parts = Pick<LeftOverMonth, "spending" | "savings" | "credit" | "other">;

/** A month from its members and parts in øre, with the wire's signs (spec §3) and its own sums. */
function month(id: string, members: LeftOverMember[], parts: Partial<Parts> = {}): LeftOverMonth {
  const { spending = 0, savings = 0, credit = 0, other = 0 } = parts;
  const paidIn = members.reduce((acc, m) => acc + m.paidIn, 0);
  const back = members.reduce((acc, m) => acc + m.back, 0);
  return {
    month: id,
    paidIn,
    back,
    members,
    spending,
    savings,
    credit,
    other,
    change: paidIn - back - spending - credit - savings + other,
  };
}

type Flags = Partial<Pick<LeftOverData, "hasSavings" | "hasCredit">>;

function data(months: LeftOverMonth[], flags: Flags = {}): LeftOverData {
  return {
    range: { start: `${months.at(-1)?.month}-01`, end: TODAY },
    today: TODAY,
    hasSavings: flags.hasSavings ?? true,
    hasCredit: flags.hasCredit ?? true,
    months,
  };
}

/** The spec §4.2 example, in øre. */
const EXAMPLE = data([
  month(
    "2026-10",
    [
      { name: "Anna", paidIn: 1_800_000, back: 200_000 },
      { name: "Bo", paidIn: 1_300_000, back: 0 },
    ],
    { spending: 2_750_000 },
  ),
  month(
    "2026-09",
    [
      { name: "Anna", paidIn: 1_250_000, back: 0 },
      { name: "Bo", paidIn: 1_250_000, back: 0 },
    ],
    { spending: 2_380_000, credit: -1_000_000, savings: 1_200_000, other: 20_000 },
  ),
  month(
    "2026-08",
    [
      { name: "Anna", paidIn: 1_250_000, back: 0 },
      { name: "Bo", paidIn: 1_250_000, back: 0 },
    ],
    { spending: 3_000_000, credit: -600_000 },
  ),
]);

/** The cell's text as a whole number of kroner: "+10.000 lånt" is 10000, "−2.000" is −2000. */
function amount(cell: Cell): number {
  const match = /^([+−]?)([\d.]+)/.exec(cell.text);
  if (match === null) throw new Error(`no amount in "${cell.text}"`);
  const value = Number(match[2].replaceAll(".", ""));
  return match[1] === "−" ? -value : value;
}

function expectSumRules(row: Row): void {
  const c = row.cells;
  expect(amount(c.leftOver), `${row.name}: Til overs`).toBe(amount(c.paidIn) + amount(c.back) + amount(c.spending));
  expect(amount(c.change), `${row.name}: Ændring på konti`).toBe(
    amount(c.leftOver) + amount(c.credit) + amount(c.savings) + amount(c.other),
  );
}

function texts(row: Row): Record<string, string> {
  const out: Record<string, string> = { name: row.name };
  for (const [column, cell] of Object.entries(row.cells)) {
    out[column] = cell.members === undefined ? cell.text : `${cell.text} | ${cell.members}`;
  }
  return out;
}

describe("the Til overs amounts", () => {
  it("rounds øre to whole kroner the way kr() does, halves away from zero", () => {
    for (const ore of [0, 49, 50, 149, 150, 250, 1_234_550]) {
      for (const signed of [ore, -ore]) {
        expect(kr(roundKroner(signed) * 100)).toBe(kr(signed));
      }
    }
    expect(roundKroner(50)).toBe(1);
    expect(roundKroner(-50)).toBe(-1);
    expect(roundKroner(-49)).toBe(0);
    expect(Object.is(roundKroner(-49), 0)).toBe(true);
  });

  it("signs every amount but zero", () => {
    expect(signedKroner(150_000)).toBe("+1.500");
    expect(signedKroner(-200_000)).toBe("−2.000");
    expect(signedKroner(0)).toBe("0");
    expect(signedKroner(-10)).toBe("0");
  });
});

describe("the Til overs table", () => {
  it("gives the spec's example rows and I alt, text for text", () => {
    const table = leftOverTable(EXAMPLE, TODAY);
    expect(table.columns).toEqual<Column[]>([
      "paidIn",
      "back",
      "spending",
      "leftOver",
      "credit",
      "savings",
      "other",
      "change",
    ]);
    expect(table.rows.map((r) => [r.month, r.running])).toEqual([
      ["2026-10", true],
      ["2026-09", false],
      ["2026-08", false],
    ]);
    expect(table.rows.map(texts)).toEqual([
      {
        name: "okt.",
        paidIn: "+31.000 | Anna 18.000 · Bo 13.000",
        back: "−2.000 | Anna 2.000",
        spending: "−27.500",
        leftOver: "+1.500",
        credit: "0",
        savings: "0",
        other: "0",
        change: "+1.500",
      },
      {
        name: "sep.",
        paidIn: "+25.000 | Anna 12.500 · Bo 12.500",
        back: "0",
        spending: "−23.800",
        leftOver: "+1.200",
        credit: "+10.000 lånt",
        savings: "−12.000",
        other: "+200",
        change: "−600",
      },
      {
        name: "aug.",
        paidIn: "+25.000 | Anna 12.500 · Bo 12.500",
        back: "0",
        spending: "−30.000",
        leftOver: "−5.000",
        credit: "+6.000 lånt",
        savings: "0",
        other: "0",
        change: "+1.000",
      },
    ]);
    expect(texts(table.total)).toEqual({
      name: "I alt",
      paidIn: "+81.000 | Anna 43.000 · Bo 38.000",
      back: "−2.000 | Anna 2.000",
      spending: "−81.300",
      leftOver: "−2.300",
      credit: "+16.000 lånt",
      savings: "−12.000",
      other: "+200",
      change: "+1.900",
    });
    expect(table.total.running).toBe(false);
  });

  it("names a paid-down credit line and a refund-heavy month", () => {
    const table = leftOverTable(data([month("2026-07", [], { credit: 500_000, spending: -40_000 })]), TODAY);
    expect(table.rows[0].cells.credit.text).toBe("−5.000 betalt af");
    expect(table.rows[0].cells.spending.text).toBe("+400");
    expectSumRules(table.rows[0]);
  });

  it("adds two members' 50 øre up to Ind +2, not +1", () => {
    const table = leftOverTable(
      data([
        month("2026-10", [
          { name: "Anna", paidIn: 50, back: 0 },
          { name: "Bo", paidIn: 50, back: 0 },
        ]),
      ]),
      TODAY,
    );
    const row = table.rows[0];
    expect(row.cells.paidIn.text).toBe("+2");
    expect(row.cells.paidIn.members).toBe("Anna 1 · Bo 1");
    expect(row.cells.leftOver.text).toBe("+2");
    expectSumRules(row);
    expectSumRules(table.total);
    expect(table.total.cells.paidIn.text).toBe("+2");
  });

  it("reads an Øvrigt of −50 øre as −1, and both sum rules hold", () => {
    const table = leftOverTable(data([month("2026-10", [], { other: -50 })]), TODAY);
    const row = table.rows[0];
    expect(row.cells.other.text).toBe("−1");
    expect(row.cells.change.text).toBe("−1");
    expect(row.cells.leftOver.text).toBe("0");
    expectSumRules(row);
    expectSumRules(table.total);
  });

  it("holds both sum rules on every row and on I alt", () => {
    for (const answer of [
      EXAMPLE,
      leftOverFor({ start: "2025-06-15", end: "2026-11-10" }),
      data([
        month("2026-10", [{ name: "Anna", paidIn: 33_349, back: 10_050 }], {
          spending: 12_350,
          savings: -4_450,
          credit: 2_550,
          other: -1_150,
        }),
        month("2026-09", [{ name: "Bo", paidIn: 150, back: 250 }], { spending: -350, other: 49 }),
      ]),
    ]) {
      const table = leftOverTable(answer, TODAY);
      for (const row of [...table.rows, table.total]) expectSumRules(row);
    }
  });

  it("leaves out the members line where no member has an amount", () => {
    const table = leftOverTable(data([month("2026-10", [{ name: "Anna", paidIn: 100_000, back: 0 }])]), TODAY);
    expect(table.rows[0].cells.back.members).toBeUndefined();
    expect(table.rows[0].cells.spending.members).toBeUndefined();
    const zero = leftOverTable(data([month("2026-10", [])]), TODAY);
    expect(zero.rows[0].cells.paidIn).toEqual({ text: "0", tone: "plain" });
  });

  it("hides Kreditten without credit lines and Opsparing without savings categories", () => {
    expect(leftOverTable({ ...EXAMPLE, hasCredit: false }, TODAY).columns).toEqual<Column[]>([
      "paidIn",
      "back",
      "spending",
      "leftOver",
      "savings",
      "other",
      "change",
    ]);
    expect(leftOverTable({ ...EXAMPLE, hasSavings: false }, TODAY).columns).toEqual<Column[]>([
      "paidIn",
      "back",
      "spending",
      "leftOver",
      "credit",
      "other",
      "change",
    ]);
    expect(leftOverTable({ ...EXAMPLE, hasCredit: false, hasSavings: false }, TODAY).columns).not.toContain("credit");
  });

  it("colours Til overs, a draw and a falling balance, and nothing else", () => {
    const table = leftOverTable(
      data([...EXAMPLE.months, month("2026-07", [], { credit: 500_000 }), month("2026-06", [])]),
      TODAY,
    );
    const tones = [...table.rows, table.total].map((r) =>
      Object.fromEntries(Object.entries(r.cells).map(([column, cell]) => [column, cell.tone])),
    );
    const plain = {
      paidIn: "plain",
      back: "plain",
      spending: "plain",
      leftOver: "plain",
      credit: "plain",
      savings: "plain",
      other: "plain",
      change: "plain",
    };
    expect(tones).toEqual([
      { ...plain, leftOver: "success" },
      { ...plain, leftOver: "success", credit: "danger", change: "danger" },
      { ...plain, leftOver: "danger", credit: "danger" },
      { ...plain, change: "danger" },
      plain,
      { ...plain, leftOver: "danger", credit: "danger", change: "danger" },
    ]);
  });

  it("names the months with their year when they span two calendar years", () => {
    const table = leftOverTable(data([month("2026-01", []), month("2025-12", [])]), TODAY);
    expect(table.rows.map((r) => r.name)).toEqual(["jan. 2026", "dec. 2025"]);
    expect(table.rows.every((r) => !r.running)).toBe(true);
  });
});

describe("the Til overs card's numbers", () => {
  const year = leftOverFor({ start: "2026-01-01", end: "2026-12-31" });
  const totalOf = (months: LeftOverMonth[]) => {
    const total = leftOverTable({ ...year, months }, TODAY).total.cells;
    return { leftOver: amount(total.leftOver) * 100, paidIn: amount(total.paidIn) * 100 };
  };

  it("takes only the span's month", () => {
    const july = year.months.filter((m) => m.month === "2026-07");
    expect(leftOverCard(year, { start: "2026-07-01", end: "2026-07-31" })).toMatchObject(totalOf(july));
  });

  it("takes only the span's year inside a longer answer", () => {
    const long = leftOverFor({ start: "2025-03-01", end: "2026-10-30" });
    const in2025 = long.months.filter((m) => m.month.startsWith("2025-"));
    expect(in2025).toHaveLength(10);
    const card = leftOverCard(long, { start: "2025-01-01", end: "2025-12-31" });
    expect(card).toMatchObject(totalOf(in2025));
    expect(card.leftOver).not.toBe(totalOf(long.months).leftOver);
  });

  it("takes the whole first and last months of a span that cuts them, as I alt does", () => {
    const span = { start: "2026-09-15", end: "2026-11-10" };
    const cut = year.months.filter((m) => m.month >= "2026-09" && m.month <= "2026-11");
    expect(cut.map((m) => m.month)).toEqual(["2026-11", "2026-10", "2026-09"]);
    expect(leftOverCard(year, span)).toMatchObject(totalOf(cut));
    const answer = leftOverFor(span);
    expect(leftOverCard(answer, span).leftOver).toBe(amount(leftOverTable(answer, TODAY).total.cells.leftOver) * 100);
  });

  it("gives the size of a net draw, else null", () => {
    expect(leftOverCard(EXAMPLE, { start: "2026-08-01", end: "2026-10-30" })).toEqual({
      leftOver: -230_000,
      paidIn: 8_100_000,
      borrowed: 1_600_000,
    });
    expect(leftOverCard(EXAMPLE, { start: "2026-10-01", end: "2026-10-30" }).borrowed).toBeNull();
    const paidDown = data([month("2026-10", [], { credit: 500_000 })]);
    expect(leftOverCard(paidDown, { start: "2026-10-01", end: "2026-10-30" }).borrowed).toBeNull();
  });
});
