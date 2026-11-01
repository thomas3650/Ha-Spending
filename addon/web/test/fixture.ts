import type { Period, Posting, SpendingData, Subscription } from "@ha-spending/shared";

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

const POSTINGS: Posting[] = rows.map(([category, text, amount, account, date], i) => ({
  id: `p${i + 1}`,
  groupId: `g${i + 1}`,
  date,
  text,
  account,
  category,
  shop: text === "Husleje" || text === "Kiosken" ? null : text,
  kind: amount < 0 ? "refund" : "spending",
  amount,
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
  };
}

export const SUBSCRIPTIONS: Subscription[] = [
  {
    id: "b1",
    name: "Husleje",
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
    repeat: "monthly",
    skip: 1,
    start: "2026-11-20",
    end: null,
    amountMin: 20000,
    amountMax: 20000,
    lastPayment: null,
  },
];

export function withSubscriptions(answer: SpendingData, subscriptions = SUBSCRIPTIONS): SpendingData {
  return { ...answer, subscriptions };
}
