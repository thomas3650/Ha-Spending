import { type Posting, unitAt, unitsOf } from "@ha-spending/shared";
import { fireEvent, getAllByRole, getByRole, queryByRole, queryByText } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";

import { kr, unitName } from "../src/format";
import { da } from "../src/i18n/da";
import { answerFor, OBJECT_GROUP } from "./fixture";
import { json, mount, settle, unmount } from "./mount";
import { cardNames } from "./text";

afterEach(unmount);

const TODAY = "2026-10-30";
const SEPTEMBER = unitName(unitAt("2026-09-01", "month", TODAY), "month");

function barsList(root: HTMLElement, name: string): HTMLElement {
  return getByRole(getByRole(root, "region", { name }), "list");
}

function dayButtons(root: HTMLElement, name = da.per("day")): HTMLElement[] {
  return getAllByRole(barsList(root, name), "button");
}

function names(buttons: HTMLElement[]): string[] {
  return buttons.map((b) => b.textContent?.trim() ?? "");
}

function pressed(buttons: HTMLElement[]): string[] {
  return buttons.map((b) => b.getAttribute("aria-pressed") ?? "");
}

describe("a one-month period draws its days", () => {
  it("Sidste måned draws a bar per day of September", async () => {
    const { root } = await mount("period=lastMonth");
    const buttons = dayButtons(root);
    expect(buttons).toHaveLength(30);
    expect(buttons[0]).toBe(getByRole(root, "button", { name: `1.9.2026, ${kr(800000)}` }));
    expect(buttons[29]).toBe(getByRole(root, "button", { name: `30.9.2026, ${kr(0)}` }));
    expect(queryByRole(root, "region", { name: da.per("month") })).toBeNull();
  });

  it("a day's bar is the sum of its postings", async () => {
    const extra: Posting = {
      id: "extra",
      groupId: "extra",
      date: "2026-09-20",
      text: "Pizzeria Roma",
      account: "2",
      category: "Café",
      kind: "spending",
      shop: "Pizzeria Roma",
      amount: 15000,
      subscription: null,
    };
    const answer = (range: { start: string; end: string }) => {
      const data = answerFor(range);
      const postings = extra.date >= range.start && extra.date <= range.end ? [extra, ...data.postings] : data.postings;
      return json({ ...data, postings });
    };
    const { root } = await mount("period=lastMonth", { answer });
    getByRole(barsList(root, da.per("day")), "button", { name: `20.9.2026, ${kr(85000)}` });
  });

  it("a refund-only day is named with a plus", async () => {
    const { root } = await mount("period=lastMonth");
    getByRole(barsList(root, da.per("day")), "button", { name: `22.9.2026, +${kr(20000)} ${da.refundMark}` });
  });

  it("Denne måned draws the whole month", async () => {
    const { root } = await mount("period=thisMonth");
    const buttons = dayButtons(root);
    expect(buttons).toHaveLength(31);
    expect(names(buttons).map((n) => n.includes(da.inProgress))).toEqual(Array.from({ length: 31 }, (_, i) => i === 29));
  });

  it("Denne måned on the 1st draws the whole month, not one bar", async () => {
    const answer = (range: { start: string; end: string }) => json(answerFor(range, "2026-10-01"));
    const { root } = await mount("period=thisMonth", { now: "2026-10-01T10:00:00Z", answer });
    getByRole(root, "region", { name: da.per("day") });
    const buttons = dayButtons(root);
    expect(buttons).toHaveLength(31);
    expect(names(buttons).map((n) => n.includes(da.inProgress))).toEqual(Array.from({ length: 31 }, (_, i) => i === 0));
  });

  it("a custom period inside a month draws its own days", async () => {
    const { root } = await mount("period=custom&from=2026-10-05&to=2026-10-20");
    expect(dayButtons(root)).toHaveLength(16);
    unmount();
    const ending = await mount("period=custom&from=2026-10-20&to=2026-10-30");
    expect(dayButtons(ending.root)).toHaveLength(11);
  });

  it("two months by Måned, or a month by Uge, draw as today", async () => {
    const { root } = await mount("period=custom&from=2026-09-15&to=2026-10-14");
    expect(getAllByRole(barsList(root, da.per("month")), "button")).toHaveLength(2);
    unmount();
    const weeks = await mount("period=lastMonth&by=week");
    const period = { start: "2026-09-01", end: "2026-09-30" };
    const expected = unitsOf(period, "week", TODAY).map((u) => unitName(u, "week"));
    const shown = names(getAllByRole(barsList(weeks.root, da.per("week")), "button")).map((n) => n.split(",")[0]);
    expect(shown).toEqual(expected);
  });

  it("the title names the main group per day", async () => {
    const { root } = await mount("period=lastMonth&group=Mad");
    getByRole(root, "region", { name: da.levelPer("Mad", "day") });
  });

  it("no average line on day bars", async () => {
    const average = new RegExp(`^${da.average("")}`);
    const { root } = await mount("period=lastMonth");
    expect(queryByText(getByRole(root, "region", { name: da.per("day") }), average)).toBeNull();
    unmount();
    const year = await mount("");
    expect(queryByText(getByRole(year.root, "region", { name: da.per("month") }), average)).not.toBeNull();
  });

  it("the month stays the month", async () => {
    const { root } = await mount("period=lastMonth");
    expect(location.hash).toBe("#period=lastMonth");
    expect((getByRole(root, "combobox", { name: da.groupBy }) as HTMLSelectElement).value).toBe("month");
    expect(cardNames(root, [OBJECT_GROUP])).toEqual([da.spendingInPeriod, da.averagePer("month")]);
    unmount();
    const postings = await mount("period=lastMonth&card=postings");
    const card = getByRole(postings.root, "region", { name: da.postingsTitle });
    const lines = getAllByRole(card, "button").filter((b) => b.hasAttribute("aria-expanded"));
    expect(lines).toHaveLength(1);
    expect(lines[0].textContent).toContain(SEPTEMBER);
  });
});

describe("a click on a day bar", () => {
  it("chooses the month", async () => {
    const { app, root } = await mount("period=lastMonth");
    fireEvent.click(getByRole(barsList(root, da.per("day")), "button", { name: /^12\.9\.2026,/ }));
    await settle(app);
    expect(location.hash).toBe("#period=lastMonth&unit=2026-09-01&card=postings");
    getByRole(root, "button", { name: da.remove(SEPTEMBER) });
  });

  it("the chosen month presses every day", async () => {
    const { app, root } = await mount("period=lastMonth&unit=2026-09-01");
    expect(pressed(dayButtons(root))).toEqual(Array.from({ length: 30 }, () => "true"));
    fireEvent.click(getByRole(barsList(root, da.per("day")), "button", { name: /^5\.9\.2026,/ }));
    await settle(app);
    expect(location.hash).toBe("#period=lastMonth");
    expect(pressed(dayButtons(root))).toEqual(Array.from({ length: 30 }, () => "false"));
  });
});
