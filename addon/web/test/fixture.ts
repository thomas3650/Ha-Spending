import {
  addMonths,
  type LeftOverData,
  type LeftOverMonth,
  type Period,
  type Posting,
  type SpendingData,
  type Subscription,
} from "@ha-spending/shared";

import { da } from "../src/i18n/da";

export const LINK = "http://firefly.test";

type Row = [category: string | null, text: string, amount: number, account: string, date: string];

const months = (day: string) => Array.from({ length: 10 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}-${day}`);

const rows: Row[] = [
  ...["2025-12-01", ...months("01")].map((date): Row => ["Husleje", "Husleje", 800000, "1", date]),
  ...["2025-12-10", ...months("10")].map(
    (date): Row => ["Dagligvarer", "Netto", date === "2026-07-10" ? 450000 : 300000, "1", date],
  ),
  ["Café", "Café Søde", 50000, "2", "2026-07-15"],
  ["Café", "Pizzeria Roma", 70000, "2", "2026-09-20"],
  ["Café", "Pizzeria Roma", -20000, "2", "2026-09-22"],
  ["Café", "Café Søde", 31012, "2", "2026-10-26"],
  ["Brændstof", "Shell", 60000, "2", "2026-03-05"],
  ["Brændstof", "Q8", 90000, "2", "2026-07-03"],
  ["Gaver", "Legetøjsbutikken", 100000, "1", "2025-12-20"],
  ["Gaver", "Boghandlen", 120000, "1", "2026-07-04"],
  [null, "Kiosken", 15000, "1", "2026-02-14"],
];

const BANK_TEXTS: Record<string, string> = { Netto: "DK NETTO 4521", "Pizzeria Roma": "MOBILEPAY 1234" };

const POSTINGS: Posting[] = rows.map(([category, text, amount, account, date], i) => ({
  id: `p${i + 1}`,
  groupId: `g${i + 1}`,
  date,
  text: BANK_TEXTS[text] ?? text,
  account,
  category,
  shop: text === "Husleje" || text === "Kiosken" ? null : text,
  kind: amount < 0 ? "refund" : "spending",
  amount,
  subscription:
    text === "Pizzeria Roma" && date === "2026-09-20"
      ? { id: "b7", name: "Pizzaabonnement", objectGroup: "Abonnementer" }
      : null,
}));

export function answerFor(range: Period, today = "2026-10-30"): SpendingData {
  return {
    range,
    today,
    earliestPostingDate: "2025-12-01",
    postings: POSTINGS.filter((p) => p.date >= range.start && p.date <= range.end).sort((a, b) =>
      b.date.localeCompare(a.date),
    ),
    accounts: [
      { id: "1", name: "Fælleskonto" },
      { id: "2", name: "Kreditkort" },
    ],
    categories: [
      { name: "Brændstof", mainGroup: "Bil" },
      { name: "Café", mainGroup: "Mad" },
      { name: "Dagligvarer", mainGroup: "Mad" },
      { name: "Gaver", mainGroup: null },
      { name: "Husleje", mainGroup: "Bolig" },
    ],
    mainGroups: ["Bil", "Bolig", "Mad"],
    mainGroupsFound: true,
    fireflyLinkUrl: LINK,
    subscriptions: [],
    leftOver: false,
  };
}

export const SUBSCRIPTIONS: Subscription[] = [
  {
    id: "b1",
    name: "Husleje",
    objectGroup: "Faste udgifter",
    repeat: "monthly",
    skip: 0,
    start: "2025-01-01",
    end: null,
    amountMin: 800000,
    amountMax: 800000,
    lastPayment: { date: "2026-10-01", amount: 800000, category: "Husleje", account: "1" },
  },
  {
    id: "b2",
    name: "Streaming",
    objectGroup: "Abonnementer",
    repeat: "monthly",
    skip: 0,
    start: "2025-01-15",
    end: null,
    amountMin: 9900,
    amountMax: 12900,
    lastPayment: { date: "2026-10-15", amount: 14900, category: "Café", account: "2" },
  },
  {
    id: "b3",
    name: "Indboforsikring",
    objectGroup: "Faste udgifter",
    repeat: "quarterly",
    skip: 0,
    start: "2025-01-05",
    end: null,
    amountMin: 90000,
    amountMax: 90000,
    lastPayment: { date: "2026-04-05", amount: 90000, category: "Husleje", account: "1" },
  },
  {
    id: "b4",
    name: "Bilforsikring",
    objectGroup: "Faste udgifter",
    repeat: "yearly",
    skip: 0,
    start: "2025-03-01",
    end: null,
    amountMin: 480000,
    amountMax: 480000,
    lastPayment: { date: "2026-03-01", amount: 480000, category: "Brændstof", account: "2" },
  },
  {
    id: "b5",
    name: "Avis",
    objectGroup: "Faste udgifter",
    repeat: "monthly",
    skip: 1,
    start: "2026-11-20",
    end: null,
    amountMin: 20000,
    amountMax: 20000,
    lastPayment: null,
  },
  {
    id: "b6",
    name: "Tennisklub",
    objectGroup: "Abonnementer",
    repeat: "monthly",
    skip: 0,
    start: "2026-01-12",
    end: null,
    amountMin: 15000,
    amountMax: 15000,
    lastPayment: { date: "2026-10-12", amount: 15000, category: "Gaver", account: "1" },
  },
];

export function withSubscriptions(answer: SpendingData, subscriptions = SUBSCRIPTIONS): SpendingData {
  return { ...answer, subscriptions };
}

/** The key-number card the fixture's object group draws beside the period's own cards. */
export const OBJECT_GROUP = da.inPeriod("Abonnementer");

export function withLeftOver(answer: SpendingData): SpendingData {
  return { ...answer, leftOver: true };
}

type LeftOverParts = Pick<LeftOverMonth, "members" | "spending" | "savings" | "credit" | "other">;

const ANNA_AND_BO: LeftOverMonth["members"] = [
  { name: "Anna", paidIn: 1_400_000, back: 0 },
  { name: "Bo", paidIn: 1_100_000, back: 0 },
];

/** A month not listed is a plain one: both members pay in, and the spending is a little less. */
const LEFT_OVER_MONTHS: Record<string, Partial<LeftOverParts>> = {
  "2026-10": {
    members: [
      { name: "Anna", paidIn: 1_800_000, back: 200_000 },
      { name: "Bo", paidIn: 1_300_000, back: 0 },
    ],
    spending: 2_750_000,
  },
  "2026-09": { spending: 3_380_050, credit: -1_000_000, savings: 120_000, other: 2_050 },
  "2026-08": { spending: 2_200_000, credit: 300_000 },
  "2026-07": { spending: -45_000, savings: -120_000 },
  "2026-06": { members: [], spending: 0 },
};

function leftOverMonth(month: string): LeftOverMonth {
  const { members = ANNA_AND_BO, spending = 2_412_345, savings = 0, credit = 0, other = 0 } =
    LEFT_OVER_MONTHS[month] ?? {};
  const paidIn = members.reduce((acc, m) => acc + m.paidIn, 0);
  const back = members.reduce((acc, m) => acc + m.back, 0);
  return {
    month,
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

/**
 * Every calendar month the range touches, newest first: two members, money back to one, a draw on the credit line
 * and a payment, money to and from savings, a refund-heavy month and a month of zeros.
 */
export function leftOverFor(range: Period, today = "2026-10-30"): LeftOverData {
  const start = range.start.slice(0, 7);
  const months: LeftOverMonth[] = [];
  for (let first = `${range.end.slice(0, 7)}-01`; first.slice(0, 7) >= start; first = addMonths(first, -1)) {
    months.push(leftOverMonth(first.slice(0, 7)));
  }
  return { range, today, hasSavings: true, hasCredit: true, months };
}
