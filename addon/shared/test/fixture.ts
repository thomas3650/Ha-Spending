import type { Category, Posting } from "../src/types";
import type { Timeline } from "../src/units";

export const categories: Category[] = [
  { name: "Dagligvarer", mainGroup: "Mad" },
  { name: "Café", mainGroup: "Mad" },
  { name: "Husleje", mainGroup: "Bolig" },
  { name: "Gaver", mainGroup: null },
];

function posting(id: string, date: string, account: string, category: string | null, amount: number): Posting {
  return {
    id,
    groupId: `g${id}`,
    date,
    text: `Posting ${id}`,
    account,
    category,
    shop: `Posting ${id}`,
    kind: amount < 0 ? "refund" : "spending",
    amount,
  };
}

export const postings: Posting[] = [
  posting("p1", "2025-12-03", "A", "Dagligvarer", 10000),
  posting("p2", "2025-12-20", "A", "Husleje", 500000),
  posting("p3", "2026-01-05", "A", "Dagligvarer", 20000),
  posting("p4", "2026-01-06", "B", "Café", 5000),
  posting("p5", "2026-01-20", "A", "Dagligvarer", -2000),
  posting("p6", "2026-01-31", "A", "Husleje", 500000),
  posting("p7", "2026-02-02", "B", "Gaver", 3000),
  posting("p8", "2026-02-14", "A", null, 1500),
  posting("p9", "2026-02-27", "A", "Husleje", 500000),
  posting("p10", "2026-03-02", "A", "Dagligvarer", 12000),
  posting("p11", "2026-03-17", "B", "Café", 4000),
];

export const T: Timeline = {
  period: { start: "2026-01-01", end: "2026-03-18" },
  grouping: "month",
  today: "2026-03-18",
  earliest: "2025-12-03",
};
