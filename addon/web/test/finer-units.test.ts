import { type Period, type Posting, unitAt, unitsOf } from "@ha-spending/shared";
import { fireEvent, getAllByRole, getByRole, queryByRole, queryByText } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";

import { type BarItem, barTooltip } from "../src/components/bars";
import { rangeText, unitName } from "../src/format";
import { da } from "../src/i18n/da";
import { barButtons, barsList, names, pressed } from "./bars-helpers";
import { answerFor } from "./fixture";
import { json, mount, settle, unmount } from "./mount";

afterEach(unmount);

const TODAY = "2026-10-30";
const WEEK_43 = unitName(unitAt("2026-10-19", "week", TODAY), "week");

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

function running(buttons: HTMLElement[]): boolean[] {
  return names(buttons).map((n) => n.includes(da.inProgress));
}

function monthNames(period: Period, today = TODAY): string[] {
  return unitsOf(period, "month", today).map((u) => unitName(u, "month"));
}

function nowAt(day: string) {
  return { now: `${day}T10:00:00Z`, answer: (range: Period) => json(answerFor(range, day)) };
}

describe("a one-unit period draws finer bars", () => {
  it("a custom week by Uge draws its seven days", async () => {
    const { root } = await mount("period=custom&from=2026-10-19&to=2026-10-25&by=week", { answer: withWeekPosting });
    const buttons = barButtons(root, da.per("day"));
    expect(buttons).toHaveLength(7);
    expect(names(buttons)[0].startsWith("19.10.2026")).toBe(true);
    expect(names(buttons)[6].startsWith("25.10.2026")).toBe(true);
  });

  it("Wednesday to Friday by Uge draws three days", async () => {
    const { root } = await mount("period=custom&from=2026-10-21&to=2026-10-23&by=week", { answer: withWeekPosting });
    expect(barButtons(root, da.per("day"))).toHaveLength(3);
  });

  it("two weeks by Uge keep two week bars", async () => {
    const { root } = await mount("period=custom&from=2026-10-12&to=2026-10-25&by=week", { answer: withWeekPosting });
    expect(barButtons(root, da.per("week"))).toHaveLength(2);
  });

  it("a quarter by Kvartal draws its months", async () => {
    const { root } = await mount("period=custom&from=2026-07-01&to=2026-09-30&by=quarter");
    const shown = names(barButtons(root, da.per("month")));
    expect(shown).toHaveLength(3);
    ["Juli 2026", "August 2026", "September 2026"].forEach((name, i) => {
      expect(shown[i].startsWith(name)).toBe(true);
    });
  });

  it("a clipped quarter by Kvartal draws its clipped months", async () => {
    const hash = "period=custom&from=2026-08-15&to=2026-09-30&by=quarter";
    const { root } = await mount(hash);
    const shown = names(barButtons(root, da.per("month")));
    expect(shown).toHaveLength(2);
    expect(shown[0].startsWith("August 2026")).toBe(true);
    const first = (root.querySelector("hs-bars") as unknown as { items: BarItem[] }).items[0];
    expect(first.name).toBe("August 2026");
    expect(barTooltip(first)).toContain(rangeText({ start: "2026-08-15", end: "2026-08-31" }));
  });

  it("Sidste måned by Kvartal steps on to its days", async () => {
    const { root } = await mount("period=lastMonth&by=quarter");
    expect(barButtons(root, da.per("day"))).toHaveLength(30);
  });

  it("a single day by Uge stays one day bar", async () => {
    const { root } = await mount("period=custom&from=2026-10-21&to=2026-10-21&by=week", { answer: withWeekPosting });
    const shown = names(barButtons(root, da.per("day")));
    expect(shown).toHaveLength(1);
    expect(shown[0].startsWith("21.10.2026")).toBe(true);
  });

  it("Denne måned by Uge on 3 Oct draws 1 to 4 Oct", async () => {
    const { root } = await mount("period=thisMonth&by=week", nowAt("2026-10-03"));
    const buttons = barButtons(root, da.per("day"));
    expect(buttons).toHaveLength(4);
    expect(names(buttons)[0].startsWith("1.10.2026")).toBe(true);
    expect(names(buttons)[3].startsWith("4.10.2026")).toBe(true);
    expect(running(buttons)).toEqual([false, false, true, false]);
  });

  it("Denne måned by Kvartal draws the whole month's days", async () => {
    const { root } = await mount("period=thisMonth&by=quarter");
    const buttons = barButtons(root, da.per("day"));
    expect(buttons).toHaveLength(31);
    expect(running(buttons)[29]).toBe(true);
    expect(running(buttons)[30]).toBe(false);
  });

  it("Sidste år by År draws its twelve months", async () => {
    const { root } = await mount("period=lastYear&by=year");
    const shown = names(barButtons(root, da.per("month"))).map((n) => n.split(",")[0]);
    expect(shown).toEqual(monthNames({ start: "2025-01-01", end: "2025-12-31" }));
  });

  it("I år by År draws January to December, the months after today empty", async () => {
    const { root } = await mount("period=thisYear&by=year");
    const buttons = barButtons(root, da.per("month"));
    expect(names(buttons).map((n) => n.split(" (")[0].split(",")[0])).toEqual(
      monthNames({ start: "2026-01-01", end: "2026-12-31" }),
    );
    expect(running(buttons)).toEqual(Array.from({ length: 12 }, (_, i) => i === 9));
  });

  it("I år by År on 5 January draws twelve months, January running", async () => {
    const { root } = await mount("period=thisYear&by=year", nowAt("2026-01-05"));
    const buttons = barButtons(root, da.per("month"));
    expect(buttons).toHaveLength(12);
    expect(running(buttons)[0]).toBe(true);
  });

  it("Sidste måned by Måned draws its days, as today", async () => {
    const { root } = await mount("period=lastMonth");
    expect(barButtons(root, da.per("day"))).toHaveLength(30);
  });

  it("Sidste måned by Dag draws its days, and I år by Måned its months, as today", async () => {
    const { root } = await mount("period=lastMonth&by=day");
    expect(barButtons(root, da.per("day"))).toHaveLength(30);
    unmount();
    const year = await mount("period=thisYear");
    expect(barButtons(year.root, da.per("month"))).toHaveLength(10);
  });

  it("Alt by År with one year of data draws its months", async () => {
    const answer = (r: Period) => json({ ...answerFor(r), earliestPostingDate: "2026-02-10" });
    const hash = "period=all&by=year";
    const { root } = await mount(hash, { answer });
    const buttons = barButtons(root, da.per("month"));
    expect(names(buttons).map((n) => n.split(" (")[0].split(",")[0])).toEqual(
      monthNames({ start: "2026-02-01", end: "2026-12-31" }),
    );
    const first = (root.querySelector("hs-bars") as unknown as { items: BarItem[] }).items[0];
    expect(barTooltip(first)).toContain(rangeText({ start: "2026-02-10", end: "2026-02-28" }));
    expect(running(buttons)).toEqual(Array.from({ length: 11 }, (_, i) => i === 8));
  });

  it("I år by Måned on 5 January draws January's days", async () => {
    const { root } = await mount("period=thisYear", nowAt("2026-01-05"));
    const buttons = barButtons(root, da.per("day"));
    expect(buttons).toHaveLength(31);
    expect(running(buttons)[4]).toBe(true);
    expect(running(buttons)[30]).toBe(false);
  });
});

describe("what stays the period's", () => {
  it("a week by Uge keeps the week everywhere but the bars", async () => {
    const hash = "period=custom&from=2026-10-19&to=2026-10-25&by=week";
    const { root } = await mount(hash, { answer: withWeekPosting });
    const region = getByRole(root, "region", { name: da.per("day") });
    expect(queryByRole(root, "region", { name: da.per("week") })).toBeNull();
    expect(queryByText(region, new RegExp(`^${da.average("")}`))).toBeNull();
    expect((getByRole(root, "combobox", { name: da.groupBy }) as HTMLSelectElement).value).toBe("week");
    unmount();
    const postings = await mount(`${hash}&card=postings`, { answer: withWeekPosting });
    const card = getByRole(postings.root, "region", { name: da.postingsTitle });
    const lines = getAllByRole(card, "button").filter((b) => b.hasAttribute("aria-expanded"));
    expect(lines).toHaveLength(1);
    expect(lines[0].textContent).toContain(WEEK_43);
  });

  it("a click on a day bar chooses the week, which presses every day", async () => {
    const hash = "period=custom&from=2026-10-19&to=2026-10-25&by=week";
    const { app, root } = await mount(hash, { answer: withWeekPosting });
    fireEvent.click(getByRole(barsList(root, da.per("day")), "button", { name: /^21\.10\.2026,/ }));
    await settle(app);
    expect(location.hash).toBe(`#${hash}&unit=2026-10-19&card=postings`);
    getByRole(root, "button", { name: da.remove(WEEK_43) });
    unmount();
    const chosen = await mount(`${hash}&unit=2026-10-19`, { answer: withWeekPosting });
    expect(pressed(barButtons(chosen.root, da.per("day")))).toEqual(Array.from({ length: 7 }, () => "true"));
  });

  it("the title names the main group per finer unit", async () => {
    const { root } = await mount("period=custom&from=2026-07-01&to=2026-09-30&by=quarter&group=Mad");
    getByRole(root, "region", { name: da.levelPer("Mad", "month") });
  });
});
