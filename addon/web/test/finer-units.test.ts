import { type Period, type Posting, unitsOf } from "@ha-spending/shared";
import { getAllByRole, queryAllByRole } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";

import { type BarItem, barTooltip } from "../src/components/bars";
import { rangeText, unitName } from "../src/format";
import { da } from "../src/i18n/da";
import { barButtons, barsList, names } from "./bars-helpers";
import { answerFor } from "./fixture";
import { json, mount, unmount } from "./mount";

afterEach(unmount);

const TODAY = "2026-10-30";

/** The fixture has no spending from 12 to 25 Oct, and a period without spending draws no bars. */
const WEEK_POSTING: Posting = {
  id: "week",
  groupId: "week",
  date: "2026-10-21",
  text: "Pizzeria Roma",
  account: "2",
  category: "Café",
  kind: "spending",
  shop: "Pizzeria Roma",
  amount: 15000,
  subscription: null,
};

function withWeekPosting(range: Period): Response {
  const data = answerFor(range);
  const inRange = WEEK_POSTING.date >= range.start && WEEK_POSTING.date <= range.end;
  return json({ ...data, postings: inRange ? [WEEK_POSTING, ...data.postings] : data.postings });
}

function running(bars: HTMLElement[]): boolean[] {
  return names(bars).map((n) => n.includes(da.inProgress));
}

/** A one-unit period's finer bars choose nothing, so they are named by list items, not buttons. */
function dayItems(root: HTMLElement): HTMLElement[] {
  const list = barsList(root, da.per("day"));
  expect(queryAllByRole(list, "button")).toHaveLength(0);
  return getAllByRole(list, "listitem");
}

function monthNames(period: Period, today = TODAY): string[] {
  return unitsOf(period, "month", today).map((u) => unitName(u, "month"));
}

function nowAt(day: string) {
  return { now: `${day}T10:00:00Z`, answer: (range: Period) => json(answerFor(range, day)) };
}

describe("a one-unit period draws finer bars", () => {
  it("a custom week draws its seven days", async () => {
    const { root } = await mount("period=custom&from=2026-10-19&to=2026-10-25", { answer: withWeekPosting });
    const items = dayItems(root);
    expect(items).toHaveLength(7);
    expect(names(items)[0].startsWith("19.10.2026")).toBe(true);
    expect(names(items)[6].startsWith("25.10.2026")).toBe(true);
  });

  it("Wednesday to Friday draws three days", async () => {
    const { root } = await mount("period=custom&from=2026-10-21&to=2026-10-23", { answer: withWeekPosting });
    expect(dayItems(root)).toHaveLength(3);
  });

  it("a single day stays one day bar", async () => {
    const { root } = await mount("period=custom&from=2026-10-21&to=2026-10-21", { answer: withWeekPosting });
    const shown = names(dayItems(root));
    expect(shown).toHaveLength(1);
    expect(shown[0].startsWith("21.10.2026")).toBe(true);
  });

  it("Sidste måned draws its days", async () => {
    const { root } = await mount("period=lastMonth");
    expect(dayItems(root)).toHaveLength(30);
  });

  it("I år on 5 January draws January's days", async () => {
    const { root } = await mount("period=thisYear", nowAt("2026-01-05"));
    const items = dayItems(root);
    expect(items).toHaveLength(31);
    expect(running(items)[4]).toBe(true);
    expect(running(items)[30]).toBe(false);
  });

  it("Alt inside one month runs on to the month's end", async () => {
    const answer = (r: Period) => json({ ...answerFor(r), earliestPostingDate: "2026-10-10" });
    const { root } = await mount("period=all", { answer });
    const items = dayItems(root);
    expect(names(items)[0].startsWith("10.10.2026")).toBe(true);
    expect(running(items)).toEqual(Array.from({ length: 22 }, (_, i) => i === 20));
  });
});

describe("a period of more than one unit draws its own bars", () => {
  it("a quarter draws its months", async () => {
    const { root } = await mount("period=custom&from=2026-07-01&to=2026-09-30");
    const shown = names(barButtons(root, da.per("month")));
    expect(shown).toHaveLength(3);
    ["Juli 2026", "August 2026", "September 2026"].forEach((name, i) => {
      expect(shown[i].startsWith(name)).toBe(true);
    });
  });

  it("a clipped quarter draws its clipped months", async () => {
    const { root } = await mount("period=custom&from=2026-08-15&to=2026-09-30");
    const shown = names(barButtons(root, da.per("month")));
    expect(shown).toHaveLength(2);
    expect(shown[0].startsWith("August 2026")).toBe(true);
    const first = (root.querySelector("hs-bars") as unknown as { items: BarItem[] }).items[0];
    expect(first.name).toBe("August 2026");
    expect(barTooltip(first)).toContain(rangeText({ start: "2026-08-15", end: "2026-08-31" }));
  });

  it("Sidste år draws its twelve months", async () => {
    const { root } = await mount("period=lastYear");
    const shown = names(barButtons(root, da.per("month"))).map((n) => n.split(",")[0]);
    expect(shown).toEqual(monthNames({ start: "2025-01-01", end: "2025-12-31" }));
  });

  it("Alt with less than a year of data draws its months up to today", async () => {
    const answer = (r: Period) => json({ ...answerFor(r), earliestPostingDate: "2026-02-10" });
    const { root } = await mount("period=all", { answer });
    const buttons = barButtons(root, da.per("month"));
    expect(names(buttons).map((n) => n.split(" (")[0].split(",")[0])).toEqual(
      monthNames({ start: "2026-02-01", end: "2026-10-31" }),
    );
    const first = (root.querySelector("hs-bars") as unknown as { items: BarItem[] }).items[0];
    expect(barTooltip(first)).toContain(rangeText({ start: "2026-02-10", end: "2026-02-28" }));
    expect(running(buttons)).toEqual(Array.from({ length: 9 }, (_, i) => i === 8));
  });
});
